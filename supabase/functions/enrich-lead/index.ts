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

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ApolloContact {
  name: string;
  title: string;
  email: string | null;
  email_status: string | null;
  linkedin_url: string | null;
  phone: string | null;
  confidence: "verified" | "likely" | "guessed";
}

interface ApolloResult {
  found: boolean;
  contacts: ApolloContact[];
  primary: ApolloContact | null;
}

type SupabaseClient = ReturnType<typeof getSupabaseClient>;

// ─────────────────────────────────────────────────────────────────────────────
// Apollo.io People Search
// ─────────────────────────────────────────────────────────────────────────────

function extractDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    const hostname = new URL(url).hostname;
    // Strip www. prefix
    return hostname.replace(/^www\./, "");
  } catch {
    // If URL parsing fails, try basic extraction
    const cleaned = website
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .trim();
    return cleaned || null;
  }
}

async function searchApollo(
  sb: SupabaseClient,
  domain: string,
  companyId: string,
  leadId: string,
  businessName: string,
): Promise<ApolloResult> {
  const empty: ApolloResult = { found: false, contacts: [], primary: null };

  // ── Check Apollo provider toggle ──
  const { data: apolloToggle } = await sb
    .from("provider_configs")
    .select("is_enabled")
    .eq("provider_name", "apollo")
    .is("company_id", null)
    .maybeSingle();

  if (!apolloToggle?.is_enabled) {
    console.log("[enrich-lead] Apollo disabled by admin toggle. Skipping.");
    await logActivity(sb, "apollo_skipped", companyId,
      `Apollo search skipped for "${businessName}" — provider disabled`,
      { lead_id: leadId, reason: "provider_disabled" },
    );
    return empty;
  }

  // ── Get Apollo API key from api_keys table ──
  const { data: keyRow } = await sb
    .from("api_keys")
    .select("key_value")
    .eq("key_name", "APOLLO_API_KEY")
    .eq("is_active", true)
    .maybeSingle();

  const apolloKey = keyRow?.key_value;
  if (!apolloKey) {
    console.log("[enrich-lead] No active APOLLO_API_KEY found. Skipping Apollo search.");
    await logActivity(sb, "apollo_skipped", companyId,
      `Apollo search skipped for "${businessName}" — no API key configured`,
      { lead_id: leadId, reason: "no_api_key" },
    );
    return empty;
  }

  // ── Call Apollo /v1/people/search ──
  console.log(`[enrich-lead] Apollo people search for domain: ${domain}`);

  try {
    const response = await fetch("https://api.apollo.io/v1/people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apolloKey,
      },
      body: JSON.stringify({
        q_organization_domains: [domain],
        person_titles: [
          "CEO",
          "Founder",
          "Owner",
          "Director",
          "Managing Director",
        ],
        per_page: 3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[enrich-lead] Apollo API error: ${response.status}`, errText);
      await logActivity(sb, "apollo_error", companyId,
        `Apollo search failed for "${businessName}" — HTTP ${response.status}`,
        { lead_id: leadId, status: response.status, error: errText.slice(0, 200) },
      );
      return empty;
    }

    const data = await response.json();
    const people = data.people || [];

    if (people.length === 0) {
      console.log(`[enrich-lead] Apollo returned 0 people for ${domain}`);
      await logActivity(sb, "apollo_no_results", companyId,
        `Apollo search for "${businessName}" (${domain}) returned no contacts`,
        { lead_id: leadId, domain },
      );
      return empty;
    }

    // ── Map Apollo response to our contact format ──
    const contacts: ApolloContact[] = people.map((person: Record<string, unknown>) => {
      const firstName = (person.first_name as string) || "";
      const lastName = (person.last_name as string) || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      const email = (person.email as string) || null;
      const emailStatus = (person.email_status as string) || null;
      const linkedinUrl = (person.linkedin_url as string) || null;

      // Extract phone — Apollo nests phones in phone_numbers array
      const phoneNumbers = (person.phone_numbers as Array<{ sanitized_number?: string; raw_number?: string }>) || [];
      const directPhone = phoneNumbers.find((p) => p.sanitized_number || p.raw_number);
      const phone = directPhone?.sanitized_number || directPhone?.raw_number || null;

      // Determine confidence based on Apollo's email_status
      let confidence: "verified" | "likely" | "guessed" = "guessed";
      if (emailStatus === "verified" || emailStatus === "valid") {
        confidence = "verified";
      } else if (emailStatus === "likely" || emailStatus === "guessable") {
        confidence = "likely";
      }

      return {
        name: fullName,
        title: (person.title as string) || (person.headline as string) || "",
        email,
        email_status: emailStatus,
        linkedin_url: linkedinUrl,
        phone,
        confidence,
      };
    });

    // Sort: verified first, then likely, then guessed; prefer those with emails
    contacts.sort((a, b) => {
      const rank = { verified: 0, likely: 1, guessed: 2 };
      const aRank = rank[a.confidence] + (a.email ? 0 : 10);
      const bRank = rank[b.confidence] + (b.email ? 0 : 10);
      return aRank - bRank;
    });

    const primary = contacts[0] || null;

    console.log(`[enrich-lead] Apollo found ${contacts.length} contacts for ${domain}. Primary: ${primary?.name} (${primary?.confidence})`);

    await logActivity(sb, "apollo_search_complete", companyId,
      `Apollo found ${contacts.length} contact(s) for "${businessName}" (${domain})`,
      {
        lead_id: leadId,
        domain,
        contacts_found: contacts.length,
        primary_name: primary?.name,
        primary_confidence: primary?.confidence,
        primary_has_email: !!primary?.email,
        primary_has_phone: !!primary?.phone,
        primary_has_linkedin: !!primary?.linkedin_url,
      },
    );

    return { found: true, contacts, primary };
  } catch (err) {
    console.error("[enrich-lead] Apollo request failed:", err);
    await logActivity(sb, "apollo_error", companyId,
      `Apollo search failed for "${businessName}" — ${err instanceof Error ? err.message : "Unknown error"}`,
      { lead_id: leadId, domain, error: err instanceof Error ? err.message : "unknown" },
    );
    return empty;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

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

    // ═══════════════════════════════════════════════════════════════════════
    // LAYER 1: Apollo.io People Search (highest quality — verified contacts)
    // ═══════════════════════════════════════════════════════════════════════

    const domain = extractDomain(lead.website);
    let apolloResult: ApolloResult = { found: false, contacts: [], primary: null };
    let contactSource: string | null = null;
    let contactConfidence: string | null = null;

    if (domain) {
      apolloResult = await searchApollo(sb, domain, lead.company_id, lead_id, lead.business_name);

      if (apolloResult.found && apolloResult.primary) {
        const p = apolloResult.primary;

        // Build update payload — only overwrite empty fields
        const apolloUpdate: Record<string, unknown> = {};

        if (p.name && !lead.contact_name) apolloUpdate.contact_name = p.name;
        if (p.title && !lead.contact_role) apolloUpdate.contact_role = p.title;
        if (p.email && !lead.contact_email) {
          apolloUpdate.contact_email = p.email;
          // Set email verification status based on Apollo's status
          if (p.email_status === "verified" || p.email_status === "valid") {
            apolloUpdate.email_verification_status = "valid";
          } else if (p.email_status === "likely" || p.email_status === "guessable") {
            apolloUpdate.email_verification_status = "risky";
          }
        }
        if (p.phone && !lead.contact_phone) apolloUpdate.contact_phone = p.phone;

        // Store linkedin_url in research_data JSONB
        const existingResearch = (lead.research_data as Record<string, unknown>) || {};
        if (p.linkedin_url) {
          apolloUpdate.research_data = {
            ...existingResearch,
            linkedin_url: p.linkedin_url,
            apollo_contacts: apolloResult.contacts.map((c) => ({
              name: c.name,
              title: c.title,
              email: c.email,
              email_status: c.email_status,
              linkedin_url: c.linkedin_url,
              phone: c.phone,
              confidence: c.confidence,
            })),
            apollo_enriched_at: new Date().toISOString(),
          };
        } else {
          apolloUpdate.research_data = {
            ...existingResearch,
            apollo_contacts: apolloResult.contacts.map((c) => ({
              name: c.name,
              title: c.title,
              email: c.email,
              email_status: c.email_status,
              linkedin_url: c.linkedin_url,
              phone: c.phone,
              confidence: c.confidence,
            })),
            apollo_enriched_at: new Date().toISOString(),
          };
        }

        // Set contact provenance
        apolloUpdate.contact_source = "apollo";
        apolloUpdate.contact_confidence = p.confidence;
        contactSource = "apollo";
        contactConfidence = p.confidence;

        // Apply Apollo updates
        if (Object.keys(apolloUpdate).length > 0) {
          const { error: apolloUpdateErr } = await sb
            .from("leads")
            .update(apolloUpdate)
            .eq("id", lead_id);

          if (apolloUpdateErr) {
            console.error("[enrich-lead] Failed to save Apollo data:", apolloUpdateErr);
          } else {
            console.log(`[enrich-lead] Apollo contact saved for lead ${lead_id}: ${p.name} (${p.confidence})`);
          }
        }
      }
    } else {
      console.log(`[enrich-lead] No domain available for lead ${lead_id} — skipping Apollo`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LAYER 2: Serper Google Search (fallback — broader web enrichment)
    // ═══════════════════════════════════════════════════════════════════════

    // Check Serper provider toggle
    const { data: serperToggle } = await sb
      .from("provider_configs")
      .select("is_enabled")
      .eq("provider_name", "serper")
      .is("company_id", null)
      .maybeSingle();

    let realEnrichData = "";

    if (serperToggle?.is_enabled) {
      // Get Serper API key (env first, then DB)
      let serperKey = Deno.env.get("SERPER_API_KEY");
      if (!serperKey) {
        const { data: keyRow } = await sb
          .from("api_keys")
          .select("key_value")
          .eq("key_name", "serper_api_key")
          .eq("is_active", true)
          .maybeSingle();
        serperKey = keyRow?.key_value || null;
      }

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
    } else {
      console.log("[enrich-lead] Serper API disabled by admin toggle. Skipping Serper enrichment.");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LAYER 3: AI Analysis (always runs — synthesises all data)
    // ═══════════════════════════════════════════════════════════════════════

    // Re-fetch lead to get any Apollo updates
    const { data: freshLead } = await sb
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .maybeSingle();

    const currentLead = freshLead || lead;

    // Include Apollo results in AI context if available
    let apolloContext = "";
    if (apolloResult.found && apolloResult.contacts.length > 0) {
      apolloContext = `\n\nAPOLLO.IO VERIFIED CONTACTS (already saved — do NOT override):
${JSON.stringify(apolloResult.contacts.map((c) => ({
  name: c.name,
  title: c.title,
  email: c.email,
  email_status: c.email_status,
  linkedin: c.linkedin_url,
  phone: c.phone,
  confidence: c.confidence,
})), null, 2)}

IMPORTANT: Apollo contacts have already been saved to the lead. Do NOT include them in key_contacts again. Focus your key_contacts on any ADDITIONAL contacts found in web search that Apollo missed.`;
    }

    const aiData = await callAI({
      systemPrompt: `You are a business intelligence analyst. You must ONLY provide information supported by actual search results. Never fabricate revenue figures, employee counts, or contact details. If data is not available in the search results, say "Not publicly available".`,
      userContent: `Enrich this lead using ONLY the real search data provided:
${JSON.stringify({
  business_name: currentLead.business_name,
  website: currentLead.website,
  industry: currentLead.industry,
  city: currentLead.city,
  region: currentLead.region,
  country: currentLead.country,
  description: currentLead.description,
  size_estimate: currentLead.size_estimate,
  contact_name: currentLead.contact_name,
  contact_role: currentLead.contact_role,
  contact_email: currentLead.contact_email,
}, null, 2)}${apolloContext}${realEnrichData}`,
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
                  description: "ADDITIONAL contacts from web search only — do NOT duplicate Apollo contacts",
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

    // ═══════════════════════════════════════════════════════════════════════
    // Save AI enrichment results (merge with Apollo data already saved)
    // ═══════════════════════════════════════════════════════════════════════

    // Re-fetch to get latest research_data (may include Apollo updates)
    const { data: latestLead } = await sb
      .from("leads")
      .select("research_data, contact_name, contact_role, contact_email, contact_source")
      .eq("id", lead_id)
      .maybeSingle();

    const existingResearch = (latestLead?.research_data as Record<string, unknown>) || {};

    const dataSource = apolloResult.found
      ? "apollo+serper+ai"
      : serperToggle?.is_enabled
        ? "serper+ai"
        : "ai_only";

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
        data_source: dataSource,
      },
      enrichment_source: "ai_enrichment",
    };

    const updatePayload: Record<string, unknown> = {
      research_data: updatedResearchData,
      enrichment_source: "ai_enrichment",
    };

    // Only update contact fields from AI if Apollo didn't already fill them
    if (!latestLead?.contact_source || latestLead.contact_source !== "apollo") {
      const keyContacts = enrichment.key_contacts as Array<{ name?: string; role?: string; email?: string }>;
      if (keyContacts && keyContacts.length > 0) {
        const primaryContact = keyContacts[0];
        if (primaryContact.name && !latestLead?.contact_name) {
          updatePayload.contact_name = primaryContact.name;
        }
        if (primaryContact.role && !latestLead?.contact_role) {
          updatePayload.contact_role = primaryContact.role;
        }
        if (primaryContact.email && !latestLead?.contact_email) {
          updatePayload.contact_email = primaryContact.email;
        }
        // Only set source/confidence if we actually updated contact fields from AI
        if (updatePayload.contact_name || updatePayload.contact_role || updatePayload.contact_email) {
          updatePayload.contact_source = "serper";
          updatePayload.contact_confidence = "guessed";
        }
      }
    }

    const { error: updateError } = await sb.from("leads").update(updatePayload).eq("id", lead_id);
    if (updateError) throw updateError;

    // ── Final activity log ──
    await logActivity(sb, "lead_enriched", lead.company_id,
      `Lead "${lead.business_name || lead_id}" enriched via ${dataSource}`,
      {
        lead_id,
        data_source: dataSource,
        apollo_contacts_found: apolloResult.contacts.length,
        apollo_primary: apolloResult.primary?.name || null,
        apollo_confidence: apolloResult.primary?.confidence || null,
        estimated_revenue: enrichment.estimated_revenue,
        estimated_employees: enrichment.estimated_employees,
        ai_contacts_found: (enrichment.key_contacts as unknown[])?.length || 0,
        contact_source: contactSource || latestLead?.contact_source || "ai_guess",
        contact_confidence: contactConfidence || "guessed",
      },
    );

    return jsonResponse({
      success: true,
      lead_id,
      data_source: dataSource,
      apollo: {
        found: apolloResult.found,
        contacts_count: apolloResult.contacts.length,
        primary: apolloResult.primary
          ? {
              name: apolloResult.primary.name,
              title: apolloResult.primary.title,
              has_email: !!apolloResult.primary.email,
              has_phone: !!apolloResult.primary.phone,
              has_linkedin: !!apolloResult.primary.linkedin_url,
              confidence: apolloResult.primary.confidence,
            }
          : null,
      },
      enrichment: {
        estimated_revenue: enrichment.estimated_revenue,
        estimated_employees: enrichment.estimated_employees,
        key_contacts: enrichment.key_contacts,
        tech_indicators: enrichment.tech_indicators,
        business_focus: enrichment.business_focus,
        pain_points: enrichment.pain_points,
        buying_signals: enrichment.buying_signals,
      },
    });
  } catch (e) {
    console.error("enrich-lead error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
