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
    const validationError = validateRequired(body, ["lead_id"]);
    if (validationError) return errorResponse(validationError, 400);

    const { lead_id } = body;
    if (!validateUUID(lead_id)) return errorResponse("Invalid lead_id format", 400);

    // 1. Fetch lead from DB
    const { data: lead, error: leadError } = await sb
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .maybeSingle();

    if (leadError) throw leadError;
    if (!lead) return errorResponse("Lead not found", 404);

    // 2. Call AI with enrich_lead tool
    const leadContext = {
      business_name: lead.business_name,
      website: lead.website,
      industry: lead.industry,
      city: lead.city,
      region: lead.region,
      country: lead.country,
      description: lead.description,
      size_estimate: lead.size_estimate,
      existing_research: lead.research_data,
      contact_name: lead.contact_name,
      contact_role: lead.contact_role,
      contact_email: lead.contact_email,
    };

    const aiData = await callAI({
      systemPrompt: `You are a business intelligence analyst. Given information about a business lead, enrich the data with estimated details based on your knowledge. Provide realistic estimates for revenue, employee count, key contacts, technology indicators, business focus, pain points, and buying signals. Be specific and realistic based on the industry, size, and location.`,
      userContent: `Enrich this lead:\n${JSON.stringify(leadContext, null, 2)}`,
      tools: [
        {
          type: "function",
          function: {
            name: "enrich_lead",
            description: "Return enriched data for the business lead",
            parameters: {
              type: "object",
              properties: {
                estimated_revenue: {
                  type: "string",
                  description: "Estimated annual revenue range (e.g., '$1M-$5M')",
                },
                estimated_employees: {
                  type: "number",
                  description: "Estimated number of employees",
                },
                key_contacts: {
                  type: "array",
                  description: "Key decision makers and contacts",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Contact name" },
                      role: { type: "string", description: "Job title/role" },
                      email: {
                        type: "string",
                        description: "Email address if inferable",
                      },
                      linkedin: {
                        type: "string",
                        description: "LinkedIn profile URL if inferable",
                      },
                    },
                    required: ["name", "role"],
                  },
                },
                tech_indicators: {
                  type: "array",
                  description: "Technologies or platforms likely used",
                  items: { type: "string" },
                },
                business_focus: {
                  type: "string",
                  description:
                    "Primary business focus and market positioning",
                },
                pain_points: {
                  type: "array",
                  description:
                    "Likely pain points based on industry and size",
                  items: { type: "string" },
                },
                buying_signals: {
                  type: "array",
                  description: "Indicators of purchase intent or need",
                  items: { type: "string" },
                },
              },
              required: [
                "estimated_revenue",
                "estimated_employees",
                "key_contacts",
                "tech_indicators",
                "business_focus",
                "pain_points",
                "buying_signals",
              ],
            },
          },
        },
      ],
      toolChoice: { type: "function", function: { name: "enrich_lead" } },
    });

    const enrichment = extractToolCallArgs(aiData);
    if (!enrichment) {
      return errorResponse("AI failed to generate enrichment data", 500);
    }

    // 3. Update lead's research_data JSONB with enrichment
    const existingResearch =
      (lead.research_data as Record<string, unknown>) || {};

    const updatedResearchData = {
      ...existingResearch,
      enrichment: {
        estimated_revenue: enrichment.estimated_revenue,
        estimated_employees: enrichment.estimated_employees,
        key_contacts: enrichment.key_contacts,
        tech_indicators: enrichment.tech_indicators,
        business_focus: enrichment.business_focus,
        pain_points: enrichment.pain_points,
        buying_signals: enrichment.buying_signals,
        enriched_at: new Date().toISOString(),
      },
      enrichment_source: "ai_enrichment",
    };

    const updatePayload: Record<string, unknown> = {
      research_data: updatedResearchData,
      enrichment_source: "ai_enrichment",
    };

    // 4. If contact info found in key_contacts, update contact fields
    const keyContacts = enrichment.key_contacts as Array<{
      name?: string;
      role?: string;
      email?: string;
    }>;

    if (keyContacts && keyContacts.length > 0) {
      const primaryContact = keyContacts[0];

      if (primaryContact.name && !lead.contact_name) {
        updatePayload.contact_name = primaryContact.name;
      }
      if (primaryContact.role && !lead.contact_role) {
        updatePayload.contact_role = primaryContact.role;
      }
      if (primaryContact.email && !lead.contact_email) {
        updatePayload.contact_email = primaryContact.email;
      }
    }

    const { error: updateError } = await sb
      .from("leads")
      .update(updatePayload)
      .eq("id", lead_id);

    if (updateError) throw updateError;

    // 5. Log activity
    await logActivity(
      sb,
      "lead_enriched",
      lead.company_id,
      `Lead "${lead.business_name || lead_id}" enriched via AI (est. ${enrichment.estimated_employees} employees, ${enrichment.estimated_revenue} revenue)`,
      {
        lead_id,
        estimated_revenue: enrichment.estimated_revenue,
        estimated_employees: enrichment.estimated_employees,
        contacts_found: keyContacts?.length || 0,
        pain_points_count: (enrichment.pain_points as string[])?.length || 0,
        buying_signals_count: (enrichment.buying_signals as string[])?.length || 0,
      }
    );

    return jsonResponse({
      success: true,
      lead_id,
      enrichment: {
        estimated_revenue: enrichment.estimated_revenue,
        estimated_employees: enrichment.estimated_employees,
        key_contacts: enrichment.key_contacts,
        tech_indicators: enrichment.tech_indicators,
        business_focus: enrichment.business_focus,
        pain_points: enrichment.pain_points,
        buying_signals: enrichment.buying_signals,
      },
      contacts_updated: !!(
        keyContacts?.length &&
        (!lead.contact_name || !lead.contact_role || !lead.contact_email)
      ),
    });
  } catch (e) {
    console.error("enrich-lead error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
