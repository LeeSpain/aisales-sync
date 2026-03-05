import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getSupabaseClient,
  checkDeadSwitch,
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
    const sb = getSupabaseClient();

    const killed = await checkDeadSwitch(sb);
    if (killed) return errorResponse("AI operations are currently disabled by admin.", 503);

    const body = await req.json();
    const validationError = validateRequired(body, ["lead_id", "company_id"]);
    if (validationError) return errorResponse(validationError, 400);

    const { lead_id, campaign_id, company_id, template_type = "standard" } = body;

    if (!validateUUID(lead_id)) return errorResponse("Invalid lead_id format", 400);
    if (!validateUUID(company_id)) return errorResponse("Invalid company_id format", 400);
    if (campaign_id && !validateUUID(campaign_id)) {
      return errorResponse("Invalid campaign_id format", 400);
    }

    // 1. Fetch lead details
    const { data: lead, error: leadError } = await sb
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .maybeSingle();

    if (leadError) throw leadError;
    if (!lead) return errorResponse("Lead not found", 404);

    // Fetch company details
    const { data: company, error: companyError } = await sb
      .from("company_profiles")
      .select("*")
      .eq("id", company_id)
      .maybeSingle();

    if (companyError) throw companyError;
    if (!company) return errorResponse("Company not found", 404);

    // Fetch campaign details if provided
    let campaign = null;
    if (campaign_id) {
      const { data: campaignData } = await sb
        .from("campaigns")
        .select("*")
        .eq("id", campaign_id)
        .maybeSingle();
      campaign = campaignData;
    }

    // 2. Call AI to generate proposal
    const context = {
      lead: {
        business_name: lead.business_name,
        industry: lead.industry,
        website: lead.website,
        location: lead.city || lead.region || lead.country,
        size: lead.size_estimate,
        research_data: lead.research_data,
        contact_name: lead.contact_name,
        contact_role: lead.contact_role,
      },
      company: {
        name: company.company_name,
        services: company.services,
        description: company.description,
        industry: company.industry,
        unique_value: company.unique_value_proposition || company.value_proposition,
      },
      campaign: campaign
        ? {
            name: campaign.name,
            objective: campaign.objective,
            target_criteria: campaign.target_criteria,
          }
        : null,
      template_type,
    };

    const aiData = await callAI({
      systemPrompt: `You are an expert business proposal writer. Generate a professional, compelling proposal tailored to the specific lead and company context. The proposal should be well-structured with clear sections, demonstrate understanding of the lead's business, and present a persuasive value proposition. Template type: ${template_type}.`,
      userContent: `Generate a proposal for:\n${JSON.stringify(context, null, 2)}`,
      tools: [
        {
          type: "function",
          function: {
            name: "generate_proposal",
            description: "Generate a structured business proposal",
            parameters: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Proposal title",
                },
                executive_summary: {
                  type: "string",
                  description: "Executive summary paragraph (2-4 sentences)",
                },
                sections: {
                  type: "array",
                  description: "Proposal sections in order",
                  items: {
                    type: "object",
                    properties: {
                      heading: { type: "string", description: "Section heading" },
                      content: {
                        type: "string",
                        description: "Section content (can include markdown)",
                      },
                    },
                    required: ["heading", "content"],
                  },
                },
                deal_value_estimate: {
                  type: "number",
                  description: "Estimated deal value in USD",
                },
                valid_days: {
                  type: "number",
                  description: "Number of days the proposal is valid (default 30)",
                },
              },
              required: [
                "title",
                "executive_summary",
                "sections",
                "deal_value_estimate",
                "valid_days",
              ],
            },
          },
        },
      ],
      toolChoice: { type: "function", function: { name: "generate_proposal" } },
    });

    const proposal = extractToolCallArgs(aiData);
    if (!proposal) {
      return errorResponse("AI failed to generate proposal structure", 500);
    }

    const validDays = (proposal.valid_days as number) || 30;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    // 3. Insert into proposals table
    const { data: inserted, error: insertError } = await sb
      .from("proposals")
      .insert({
        lead_id,
        campaign_id: campaign_id || null,
        company_id,
        title: proposal.title,
        executive_summary: proposal.executive_summary,
        sections: proposal.sections,
        deal_value: proposal.deal_value_estimate,
        valid_until: validUntil.toISOString(),
        status: "draft",
        template_type,
      })
      .select("id, title")
      .single();

    if (insertError) throw insertError;

    // 4. Log activity
    await logActivity(
      sb,
      "proposal_generated",
      company_id,
      `Proposal "${proposal.title}" generated for ${lead.business_name || "lead"}`,
      {
        proposal_id: inserted.id,
        lead_id,
        campaign_id,
        deal_value: proposal.deal_value_estimate,
        valid_days: validDays,
      }
    );

    return jsonResponse({
      success: true,
      proposal_id: inserted.id,
      title: proposal.title,
      executive_summary: proposal.executive_summary,
      deal_value: proposal.deal_value_estimate,
      valid_until: validUntil.toISOString(),
      sections_count: (proposal.sections as unknown[]).length,
    });
  } catch (e) {
    console.error("generate-proposal error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
