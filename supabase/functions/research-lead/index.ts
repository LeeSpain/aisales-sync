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
    const validationError = validateRequired(body, ["lead_id"]);
    if (validationError) return errorResponse(validationError, 400);

    const { lead_id } = body;
    if (!validateUUID(lead_id)) return errorResponse("Invalid lead_id format", 400);

    // Rate limit
    if (!checkRateLimit(`research-lead:${lead_id}`, 5, 60_000)) {
      return errorResponse("Rate limit exceeded. Please try again in a moment.", 429);
    }

    const sb = getSupabaseClient();

    // Check dead switch
    const isKilled = await checkDeadSwitch(sb);
    if (isKilled) {
      return errorResponse("AI operations are currently disabled by admin.", 503);
    }

    // Fetch lead from DB
    const { data: lead, error: leadError } = await sb
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .maybeSingle();

    if (leadError) {
      console.error("Error fetching lead:", leadError);
      return errorResponse("Failed to fetch lead", 500);
    }
    if (!lead) return errorResponse("Lead not found", 404);

    // Check for website URL
    if (!lead.website) {
      return errorResponse("Lead has no website URL to research", 400);
    }

    // Fetch company profile for context
    const { data: company } = await sb
      .from("companies")
      .select("name, services, industry, target_markets, selling_points")
      .eq("id", lead.company_id)
      .maybeSingle();

    // Build AI prompt
    const systemPrompt = `You are a business research analyst. Given information about a lead business, research and extract key business intelligence.
Analyze the available information and provide a comprehensive research profile.
Be specific and data-driven. If information is not available, make reasonable inferences based on industry, size, and location.`;

    const userContent = `Research this business lead:

Business Name: ${lead.business_name}
Website: ${lead.website}
Industry: ${lead.industry || "Unknown"}
Location: ${[lead.city, lead.region, lead.country].filter(Boolean).join(", ") || "Unknown"}
Size Estimate: ${lead.size_estimate || "Unknown"}
Description: ${lead.description || "No description available"}
Rating: ${lead.rating || "N/A"} (${lead.review_count || 0} reviews)

${company ? `Our Company Context (for positioning analysis):
Company: ${company.name}
Industry: ${company.industry || "N/A"}
Services: ${JSON.stringify(company.services || [])}
Target Markets: ${JSON.stringify(company.target_markets || [])}
Selling Points: ${JSON.stringify(company.selling_points || [])}` : ""}

Provide a thorough research analysis of this lead.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "research_lead",
          description:
            "Return structured research data about the lead business",
          parameters: {
            type: "object",
            properties: {
              services_offered: {
                type: "array",
                items: { type: "string" },
                description:
                  "List of services or products the lead business offers",
              },
              target_market: {
                type: "string",
                description:
                  "Description of the lead's target market and customer base",
              },
              positioning: {
                type: "string",
                description:
                  "How the lead positions themselves in their market (premium, budget, niche, etc.)",
              },
              pricing_indicators: {
                type: "string",
                description:
                  "Any indicators about the lead's pricing level or budget capacity",
              },
              competitive_advantages: {
                type: "array",
                items: { type: "string" },
                description: "Key competitive advantages of the lead business",
              },
              recent_activity: {
                type: "array",
                items: { type: "string" },
                description:
                  "Notable recent activities, news, or changes at the lead business",
              },
              research_summary: {
                type: "string",
                description:
                  "A comprehensive summary of the research findings, including how this lead might benefit from our services",
              },
            },
            required: [
              "services_offered",
              "target_market",
              "positioning",
              "pricing_indicators",
              "competitive_advantages",
              "recent_activity",
              "research_summary",
            ],
          },
        },
      },
    ];

    // Call AI
    const aiResponse = await callAI({
      systemPrompt,
      userContent,
      tools,
      toolChoice: { type: "function", function: { name: "research_lead" } },
    });

    const researchData = extractToolCallArgs(aiResponse);

    if (!researchData) {
      console.error("AI did not return structured research data");
      return errorResponse("AI failed to generate research data", 500);
    }

    // Update lead's research_data JSONB
    const { error: updateError } = await sb
      .from("leads")
      .update({
        research_data: {
          ...researchData,
          researched_at: new Date().toISOString(),
        },
      })
      .eq("id", lead_id);

    if (updateError) {
      console.error("Error updating lead research_data:", updateError);
      return errorResponse("Failed to update lead research data", 500);
    }

    // Update lead status to "researched" if currently "discovered"
    // Note: "researched" is not in the original CHECK constraint for leads.status.
    // If the constraint has been updated to include it, this will succeed.
    // Otherwise the status remains unchanged after the research_data update above.
    if (lead.status === "discovered") {
      const { error: statusError } = await sb
        .from("leads")
        .update({ status: "researched" })
        .eq("id", lead_id)
        .eq("status", "discovered");

      if (statusError) {
        console.warn(
          "Could not update lead status to 'researched':",
          statusError.message,
        );
      }
    }

    // Log activity
    await logActivity(
      sb,
      "lead_researched",
      lead.company_id,
      `Researched lead: ${lead.business_name}`,
      {
        lead_id,
        business_name: lead.business_name,
        website: lead.website,
      },
    );

    return jsonResponse({
      status: "researched",
      lead_id,
      research_data: researchData,
    });
  } catch (e) {
    console.error("research-lead error:", e);
    return errorResponse(
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
});
