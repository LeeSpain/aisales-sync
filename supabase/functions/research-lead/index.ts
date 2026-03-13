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

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL EDGE FUNCTION CALLER (same pattern as run-campaign-pipeline)
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callScrapeUrl(
  url: string,
  hint: string = "static"
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/scrape-url`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, hint }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("[research-lead] scrape-url call failed:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const body = await req.json();

    const validationError = validateRequired(body, ["lead_id"]);
    if (validationError) return errorResponse(validationError, 400);

    const { lead_id } = body;
    if (!validateUUID(lead_id)) return errorResponse("Invalid lead_id format", 400);

    if (!checkRateLimit(`research-lead:${lead_id}`, 5, 60_000)) {
      return errorResponse("Rate limit exceeded. Please try again in a moment.", 429);
    }

    const sb = getSupabaseClient();

    const isKilled = await checkDeadSwitch(sb);
    if (isKilled) return errorResponse("AI operations are currently disabled by admin.", 503);

    // ── Check Serper provider toggle (global default row) ──
    const { data: serperToggle } = await sb
      .from("provider_configs")
      .select("is_enabled")
      .eq("provider_name", "serper")
      .is("company_id", null)
      .maybeSingle();

    if (!serperToggle?.is_enabled) {
      console.log("[research-lead] Serper API disabled by admin toggle. Skipping research.");
      return jsonResponse({ status: "skipped", reason: "serper_disabled" });
    }

    // Fetch lead from DB
    const { data: lead, error: leadError } = await sb
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .maybeSingle();

    if (leadError) return errorResponse("Failed to fetch lead", 500);
    if (!lead) return errorResponse("Lead not found", 404);

    // Fetch company profile for context
    const { data: company } = await sb
      .from("companies")
      .select("name, services, industry, target_markets, selling_points")
      .eq("id", lead.company_id)
      .maybeSingle();

    // ── Get Serper API key (env first, then DB) ──
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

    // ── Collect pages_fetched for provenance ──
    const pagesFetched: Array<{ url: string; content: string; provider: string }> = [];
    const enrichedFields: Record<string, string> = {};

    // ── Scrape lead website via scrape-url ──
    let websiteData = "";
    if (lead.website) {
      console.log(`[research-lead] Scraping website via scrape-url: ${lead.website}`);
      const scrapeResult = await callScrapeUrl(lead.website, "static");

      if (scrapeResult && !scrapeResult.error) {
        const mainContent = (scrapeResult.main_content as string) || "";
        const title = (scrapeResult.title as string) || "";
        const description = (scrapeResult.description as string) || "";
        const emailsFound = (scrapeResult.emails_found as string[]) || [];
        const phonesFound = (scrapeResult.phones_found as string[]) || [];

        if (mainContent.length > 50) {
          websiteData = `\n\nWEBSITE CONTENT (scraped from ${lead.website}):
Title: ${title}
Description: ${description}
Content: ${mainContent.slice(0, 5000)}`;

          pagesFetched.push({
            url: lead.website,
            content: mainContent,
            provider: (scrapeResult.provider_used as string) || "static",
          });
        }

        // Capture enriched fields from website scrape
        if (emailsFound.length > 0 && !lead.contact_email) {
          enrichedFields.contact_email = emailsFound[0];
        }
        if (phonesFound.length > 0 && !lead.phone) {
          enrichedFields.phone = phonesFound[0];
        }

        console.log(`[research-lead] Website scrape: ${mainContent.length} chars, ${emailsFound.length} emails, ${phonesFound.length} phones`);
      } else {
        console.warn(`[research-lead] Website scrape failed: ${scrapeResult?.error || "no response"}`);
      }
    }

    // ── Fetch REAL search data about this business (Serper) ──
    let realSearchData = "";
    if (serperKey && serperKey !== "configured") {
      const q = `"${lead.business_name}" ${[lead.city, lead.region].filter(Boolean).join(" ")}`;
      console.log(`[research-lead] Searching Serper for: "${q}"`);
      try {
        const [searchRes, newsRes] = await Promise.all([
          fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
            body: JSON.stringify({ q, num: 5 }),
          }),
          fetch("https://google.serper.dev/news", {
            method: "POST",
            headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
            body: JSON.stringify({ q, num: 3 }),
          }),
        ]);

        const [sData, nData] = await Promise.all([
          searchRes.ok ? searchRes.json() : null,
          newsRes.ok ? newsRes.json() : null,
        ]);

        const organic = sData?.organic?.slice(0, 5) || [];
        const news = nData?.news?.slice(0, 3) || [];

        if (organic.length > 0 || news.length > 0) {
          realSearchData = `\n\nREAL LIVE WEB DATA from Google Search (via Serper API):
Search results: ${JSON.stringify(organic, null, 2)}
Recent news: ${JSON.stringify(news, null, 2)}

STRICT RULE: Base your entire research profile on these real results. Do NOT invent, assume, or fabricate ANY information not present in the above data.`;
          console.log(`[research-lead] Got ${organic.length} search results, ${news.length} news items.`);

          // Find the lead's own website in organic results for provenance
          for (const result of organic) {
            if (result.link && result.snippet) {
              pagesFetched.push({
                url: result.link,
                content: `${result.title || ""}\n${result.snippet}`,
                provider: "serper",
              });
            }
          }
        }
      } catch (e) {
        console.error("[research-lead] Serper search failed:", e);
      }
    } else {
      console.warn("[research-lead] No Serper API key available — research profile will be limited.");
    }

    const systemPrompt = `You are a business research analyst. You MUST ONLY provide information directly supported by the real search data provided. Do not make up revenue figures, employee counts, or contact names. If information is not in the search data, explicitly state "Not available from public sources."`;

    const userContent = `Research this business:

Business Name: ${lead.business_name}
Website: ${lead.website || "Unknown"}
Industry: ${lead.industry || "Unknown"}
Location: ${[lead.city, lead.region, lead.country].filter(Boolean).join(", ") || "Unknown"}
Size Estimate: ${lead.size_estimate || "Unknown"}
Description: ${lead.description || "No description available"}
Rating: ${lead.rating || "N/A"} (${lead.review_count || 0} reviews)
${websiteData}
${realSearchData}

${company ? `Our Company:
Company: ${company.name}
Services: ${JSON.stringify(company.services || [])}
Target Markets: ${JSON.stringify(company.target_markets || [])}` : ""}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "research_lead",
          description: "Return structured research data based ONLY on real search results provided",
          parameters: {
            type: "object",
            properties: {
              services_offered: { type: "array", items: { type: "string" }, description: "Services or products the business offers — from real search results only" },
              target_market: { type: "string", description: "Target market — from real search results only" },
              positioning: { type: "string", description: "Market positioning — from real search results only" },
              pricing_indicators: { type: "string", description: "Pricing indicators from search data, or 'Not available from public sources'" },
              competitive_advantages: { type: "array", items: { type: "string" }, description: "Competitive advantages from search data" },
              recent_activity: { type: "array", items: { type: "string" }, description: "Recent news or activities from the news search results" },
              research_summary: { type: "string", description: "Summary of findings — only reference real data found in the search results" },
              contact_name: { type: "string", description: "Contact name found in search results, or empty string if not found" },
              contact_role: { type: "string", description: "Contact role/title found in search results, or empty string if not found" },
            },
            required: ["services_offered", "target_market", "positioning", "pricing_indicators", "competitive_advantages", "recent_activity", "research_summary"],
          },
        },
      },
    ];

    const aiResponse = await callAI({
      systemPrompt,
      userContent,
      tools,
      toolChoice: { type: "function", function: { name: "research_lead" } },
    });

    const researchData = extractToolCallArgs(aiResponse);
    if (!researchData) return errorResponse("AI failed to generate research data", 500);

    // Capture AI-extracted contact fields as enriched
    if (researchData.contact_name && !lead.contact_name) {
      enrichedFields.contact_name = researchData.contact_name as string;
    }

    const dataSource = serperKey && serperKey !== "configured" ? "serper_google_search" : "ai_only";

    const { error: updateError } = await sb
      .from("leads")
      .update({
        research_data: {
          ...researchData,
          researched_at: new Date().toISOString(),
          data_source: dataSource,
        },
        // Update enriched fields on the lead record directly
        ...(enrichedFields.contact_email ? { contact_email: enrichedFields.contact_email } : {}),
        ...(enrichedFields.phone ? { phone: enrichedFields.phone } : {}),
        ...(enrichedFields.contact_name ? { contact_name: enrichedFields.contact_name } : {}),
      })
      .eq("id", lead_id);

    if (updateError) return errorResponse("Failed to update lead research data", 500);

    if (lead.status === "discovered") {
      await sb.from("leads").update({ status: "researched" }).eq("id", lead_id).eq("status", "discovered");
    }

    await logActivity(sb, "lead_researched", lead.company_id, `Researched lead: ${lead.business_name}`, {
      lead_id,
      business_name: lead.business_name,
      website: lead.website,
      data_source: dataSource,
    });

    return jsonResponse({
      status: "researched",
      lead_id,
      research_data: researchData,
      pages_fetched: pagesFetched,
      enriched_fields: enrichedFields,
    });
  } catch (e) {
    console.error("research-lead error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
