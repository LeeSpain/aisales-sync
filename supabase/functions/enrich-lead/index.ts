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

    // ── Get Serper API key (env first, then DB) ──
    let serperKey = Deno.env.get("SERPER_API_KEY");
    if (!serperKey) {
      const { data: keyRow } = await sb
        .from("api_keys")
        .select("key_value")
        .eq("key_name", "SERPER_API_KEY")
        .eq("is_active", true)
        .maybeSingle();
      serperKey = keyRow?.key_value || null;
    }

    // ── Fetch real enrichment data via Serper ──
    let realEnrichData = "";
    if (serperKey && serperKey !== "configured") {
      const name = lead.business_name;
      const location = [lead.city, lead.region].filter(Boolean).join(" ");
      const website = lead.website || "";

      const queries = [
        `${name} ${location} company size employees revenue`,
        `${name} ${website} contact email team`,
      ];

      console.log(`[enrich-lead] Running ${queries.length} Serper queries for "${name}"`);

      const results: unknown[] = [];
      for (const q of queries) {
        try {
          const r = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
            body: JSON.stringify({ q, num: 5 }),
          });
          if (r.ok) {
            const d = await r.json();
            results.push(...(d.organic?.slice(0, 3) || []));
          }
        } catch (e) {
          console.error("[enrich-lead] Serper query failed:", e);
        }
      }

      if (results.length > 0) {
        realEnrichData = `\n\nREAL GOOGLE SEARCH DATA for enrichment:
${JSON.stringify(results, null, 2)}

STRICT RULES:
- Only state facts directly supported by the search data above
- For estimated_revenue and estimated_employees: only provide ranges if the search data contains actual clues (e.g., "50 staff" or "£2M turnover"). Otherwise state "Not publicly available"
- For key_contacts: ONLY include names/emails explicitly found in the search results — never guess or infer
- For tech_indicators: only list technologies mentioned in the search results`;
      }
    }

    // 2. Call AI with strict real-data rules
    const aiData = await callAI({
      systemPrompt: `You are a business intelligence analyst. You must ONLY provide information supported by actual search results. Never fabricate revenue figures, employee counts, or contact details. If data is not available in the search results, say "Not publicly available".`,
      userContent: `Enrich this lead using ONLY the real search data provided:
${JSON.stringify({
  business_name: lead.business_name,
  website: lead.website,
  industry: lead.industry,
  city: lead.city,
  region: lead.region,
  country: lead.country,
  description: lead.description,
  size_estimate: lead.size_estimate,
  contact_name: lead.contact_name,
  contact_role: lead.contact_role,
  contact_email: lead.contact_email,
}, null, 2)}${realEnrichData}`,
      tools: [
        {
          type: "function",
          function: {
            name: "enrich_lead",
            description: "Return enriched data based on real search results only",
            parameters: {
              type: "object",
              properties: {
                estimated_revenue: { type: "string", description: "Revenue range from search data, or 'Not publicly available'" },
                estimated_employees: { type: "number", description: "Employee count from search data, or 0 if unknown" },
                key_contacts: {
                  type: "array",
                  description: "Contacts ONLY if found in real search results — never guess",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      role: { type: "string" },
                      email: { type: "string" },
                      linkedin: { type: "string" },
                    },
                    required: ["name", "role"],
                  },
                },
                tech_indicators: { type: "array", items: { type: "string" }, description: "Technologies found in search results only" },
                business_focus: { type: "string", description: "Primary business focus from search results" },
                pain_points: { type: "array", items: { type: "string" }, description: "Industry-relevant pain points (these can be inferred from the industry)" },
                buying_signals: { type: "array", items: { type: "string" }, description: "Purchase indicators from search data or industry context" },
              },
              required: ["estimated_revenue", "estimated_employees", "key_contacts", "tech_indicators", "business_focus", "pain_points", "buying_signals"],
            },
          },
        },
      ],
      toolChoice: { type: "function", function: { name: "enrich_lead" } },
    });

    const enrichment = extractToolCallArgs(aiData);
    if (!enrichment) return errorResponse("AI failed to generate enrichment data", 500);

    // 3. Update lead's research_data JSONB
    const existingResearch = (lead.research_data as Record<string, unknown>) || {};
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
        data_source: serperKey && serperKey !== "configured" ? "serper_google_search" : "ai_only",
      },
      enrichment_source: "ai_enrichment",
    };

    const updatePayload: Record<string, unknown> = {
      research_data: updatedResearchData,
      enrichment_source: "ai_enrichment",
    };

    // 4. Only update contact fields if found in REAL search data
    const keyContacts = enrichment.key_contacts as Array<{ name?: string; role?: string; email?: string }>;
    if (keyContacts && keyContacts.length > 0) {
      const primaryContact = keyContacts[0];
      if (primaryContact.name && !lead.contact_name) updatePayload.contact_name = primaryContact.name;
      if (primaryContact.role && !lead.contact_role) updatePayload.contact_role = primaryContact.role;
      if (primaryContact.email && !lead.contact_email) updatePayload.contact_email = primaryContact.email;
    }

    const { error: updateError } = await sb.from("leads").update(updatePayload).eq("id", lead_id);
    if (updateError) throw updateError;

    await logActivity(sb, "lead_enriched", lead.company_id,
      `Lead "${lead.business_name || lead_id}" enriched via ${serperKey ? "Serper+AI" : "AI only"}`,
      { lead_id, estimated_revenue: enrichment.estimated_revenue, estimated_employees: enrichment.estimated_employees, contacts_found: keyContacts?.length || 0 }
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
      contacts_updated: !!(keyContacts?.length && (!lead.contact_name || !lead.contact_role || !lead.contact_email)),
    });
  } catch (e) {
    console.error("enrich-lead error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
