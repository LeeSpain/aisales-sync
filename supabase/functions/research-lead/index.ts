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
        .eq("key_name", "SERPER_API_KEY")
        .eq("is_active", true)
        .maybeSingle();
      serperKey = keyRow?.key_value || null;
    }

    // ── Fetch REAL search data about this business ──
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

    const { error: updateError } = await sb
      .from("leads")
      .update({
        research_data: {
          ...researchData,
          researched_at: new Date().toISOString(),
          data_source: serperKey && serperKey !== "configured" ? "serper_google_search" : "ai_only",
        },
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
      data_source: serperKey ? "serper_google_search" : "ai_only",
    });

    return jsonResponse({ status: "researched", lead_id, research_data: researchData });
  } catch (e) {
    console.error("research-lead error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
