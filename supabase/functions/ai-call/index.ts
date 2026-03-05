import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getSupabaseClient,
  checkDeadSwitch,
  checkRateLimit,
  optionsResponse,
  jsonResponse,
  errorResponse,
  callAI,
  extractToolCallArgs,
  logActivity,
} from "../_shared/utils.ts";
import { validateRequired, validateUUID } from "../_shared/validators.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const body = await req.json();

    // Validate input
    const validationError = validateRequired(body, ["lead_id", "company_id"]);
    if (validationError) return errorResponse(validationError, 400);

    const { lead_id, campaign_id, company_id, call_type } = body;

    if (!validateUUID(lead_id))
      return errorResponse("Invalid lead_id format", 400);
    if (!validateUUID(company_id))
      return errorResponse("Invalid company_id format", 400);
    if (campaign_id && !validateUUID(campaign_id))
      return errorResponse("Invalid campaign_id format", 400);

    // Rate limit
    if (!checkRateLimit(`ai-call:${lead_id}`, 5, 60_000)) {
      return errorResponse(
        "Rate limit exceeded. Please try again in a moment.",
        429,
      );
    }

    const sb = getSupabaseClient();

    // Check dead switch
    const isKilled = await checkDeadSwitch(sb);
    if (isKilled) {
      return errorResponse("AI operations are currently disabled by admin.", 503);
    }

    // Fetch lead, company, and campaign details in parallel
    const fetchPromises: Promise<unknown>[] = [
      sb.from("leads").select("*").eq("id", lead_id).maybeSingle(),
      sb
        .from("companies")
        .select(
          "name, industry, services, selling_points, target_markets, tone_preference, description",
        )
        .eq("id", company_id)
        .maybeSingle(),
    ];

    if (campaign_id) {
      fetchPromises.push(
        sb
          .from("campaigns")
          .select("name, target_description, target_criteria, estimated_deal_value")
          .eq("id", campaign_id)
          .maybeSingle(),
      );
    }

    const results = await Promise.all(fetchPromises);

    const leadResult = results[0] as { data: Record<string, unknown> | null; error: unknown };
    const companyResult = results[1] as { data: Record<string, unknown> | null; error: unknown };
    const campaignResult = campaign_id
      ? (results[2] as { data: Record<string, unknown> | null; error: unknown })
      : null;

    if (leadResult.error) {
      console.error("Error fetching lead:", leadResult.error);
      return errorResponse("Failed to fetch lead", 500);
    }
    if (!leadResult.data) return errorResponse("Lead not found", 404);

    if (companyResult.error) {
      console.error("Error fetching company:", companyResult.error);
      return errorResponse("Failed to fetch company", 500);
    }
    if (!companyResult.data) return errorResponse("Company not found", 404);

    const lead = leadResult.data;
    const company = companyResult.data;
    const campaign = campaignResult?.data || null;

    // Fetch previous outreach messages and inbound replies for context
    const [outreachResult, repliesResult] = await Promise.all([
      sb
        .from("outreach_messages")
        .select("subject, body, status, channel, sent_at, opened_at, replied_at")
        .eq("lead_id", lead_id)
        .order("created_at", { ascending: true })
        .limit(10),
      sb
        .from("inbound_replies")
        .select("body, intent, channel, created_at")
        .eq("lead_id", lead_id)
        .order("created_at", { ascending: true })
        .limit(10),
    ]);

    const previousOutreach = outreachResult.data || [];
    const previousReplies = repliesResult.data || [];

    // Build conversation history summary
    let conversationContext = "";
    if (previousOutreach.length > 0 || previousReplies.length > 0) {
      conversationContext = "\n\nPrevious Communication History:";
      for (const msg of previousOutreach) {
        conversationContext += `\n- [Outreach via ${msg.channel || "email"}] Subject: ${msg.subject || "N/A"} | Status: ${msg.status}`;
        if (msg.opened_at) conversationContext += " (opened)";
        if (msg.replied_at) conversationContext += " (replied)";
      }
      for (const reply of previousReplies) {
        conversationContext += `\n- [Reply via ${reply.channel || "email"}] Intent: ${reply.intent || "unknown"} | "${(reply.body as string || "").substring(0, 200)}"`;
      }
    }

    // Build AI prompt
    const resolvedCallType = call_type || "outbound_ai";
    const systemPrompt = `You are an expert sales call strategist. Generate a comprehensive call script for a ${resolvedCallType} sales call.
The script should be natural, conversational, and tailored to the specific lead and their business context.
Consider any previous communication history when crafting the approach.
The tone should match the company's preferred tone: ${company.tone_preference || "professional"}.
Focus on building rapport, understanding the lead's needs, and presenting relevant solutions.`;

    const userContent = `Generate a call script for this scenario:

Our Company:
Name: ${company.name}
Industry: ${company.industry || "N/A"}
Services: ${JSON.stringify(company.services || [])}
Selling Points: ${JSON.stringify(company.selling_points || [])}
Description: ${company.description || "N/A"}

Lead:
Business: ${lead.business_name}
Industry: ${lead.industry || "Unknown"}
Website: ${lead.website || "N/A"}
Contact: ${lead.contact_name || "Unknown"} (${lead.contact_role || "Unknown role"})
Location: ${[lead.city, lead.region, lead.country].filter(Boolean).join(", ") || "Unknown"}
Size: ${lead.size_estimate || "Unknown"}
Score: ${lead.score || "Unscored"} - ${lead.score_reasoning || "No reasoning"}
Research: ${lead.research_data ? JSON.stringify(lead.research_data) : "No research data available"}

${campaign ? `Campaign Context:
Name: ${campaign.name}
Target: ${campaign.target_description || "N/A"}
Criteria: ${JSON.stringify(campaign.target_criteria || {})}
Estimated Deal Value: ${campaign.estimated_deal_value || "N/A"}` : ""}
${conversationContext}

Call Type: ${resolvedCallType}

Generate a complete call script with opening, talking points, objection responses, and a closing CTA.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "generate_call_script",
          description: "Return the structured call script",
          parameters: {
            type: "object",
            properties: {
              opening: {
                type: "string",
                description:
                  "The opening statement and introduction for the call (first 30 seconds)",
              },
              talking_points: {
                type: "array",
                items: { type: "string" },
                description:
                  "Key talking points to cover during the call, in recommended order",
              },
              objection_responses: {
                type: "object",
                description:
                  "Common objections mapped to suggested responses (e.g., 'too expensive': 'response...')",
                additionalProperties: { type: "string" },
              },
              closing_cta: {
                type: "string",
                description:
                  "The closing call-to-action to end the call with a clear next step",
              },
              full_script: {
                type: "string",
                description:
                  "The complete call script as a flowing conversation guide",
              },
            },
            required: [
              "opening",
              "talking_points",
              "objection_responses",
              "closing_cta",
              "full_script",
            ],
          },
        },
      },
    ];

    const aiResponse = await callAI({
      systemPrompt,
      userContent,
      tools,
      toolChoice: {
        type: "function",
        function: { name: "generate_call_script" },
      },
    });

    const callScript = extractToolCallArgs(aiResponse);

    if (!callScript) {
      console.error("AI did not return structured call script");
      return errorResponse("AI failed to generate call script", 500);
    }

    // Insert call record into calls table
    // Using "scheduled" status since the DB CHECK constraint is:
    // ('scheduled','in_progress','completed','failed','cancelled')
    // The script is ready and the call is scheduled to be made.
    const { data: callRecord, error: insertError } = await sb
      .from("calls")
      .insert({
        lead_id,
        campaign_id: campaign_id || null,
        company_id,
        call_type: resolvedCallType === "outbound_ai" ? "outbound_ai" : "outbound_manual",
        transcript: callScript.full_script as string,
        status: "scheduled",
        summary: `Call script generated. Opening: ${(callScript.opening as string || "").substring(0, 100)}...`,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error inserting call record:", insertError);
      return errorResponse("Failed to create call record", 500);
    }

    // Log activity
    await logActivity(
      sb,
      "call_script_generated",
      company_id,
      `Call script generated for lead: ${lead.business_name}`,
      {
        call_id: callRecord.id,
        lead_id,
        campaign_id: campaign_id || null,
        call_type: resolvedCallType,
        talking_points_count: (callScript.talking_points as string[])?.length || 0,
      },
    );

    return jsonResponse({
      call_id: callRecord.id,
      script: callScript.full_script,
      talking_points: callScript.talking_points,
      opening: callScript.opening,
      objection_responses: callScript.objection_responses,
      closing_cta: callScript.closing_cta,
    });
  } catch (e) {
    console.error("ai-call error:", e);
    return errorResponse(
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
});
