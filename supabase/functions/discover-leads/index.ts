import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { optionsResponse, jsonResponse, errorResponse, getSupabaseClient, checkDeadSwitch, callAI, extractToolCallArgs, checkRateLimit } from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    if (!checkRateLimit("discover-leads", 20, 60_000)) {
      return errorResponse("Rate limit exceeded. Please try again in a moment.", 429);
    }

    const sb = getSupabaseClient();
    const isKilled = await checkDeadSwitch(sb);
    if (isKilled) return errorResponse("AI operations are currently disabled by admin.", 503);

    const { campaignId, companyProfile, targetCriteria, geographicFocus } = await req.json();
    if (!campaignId || !targetCriteria || !geographicFocus) {
      return errorResponse("Missing required params: campaignId, targetCriteria, geographicFocus", 400);
    }

    // ── Step 1: Get Serper API key ──
    // First check Deno env (deployed secret), then fall back to admin-saved key in ai_config table
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

    if (!serperKey || serperKey === "configured") {
      return errorResponse(
        "Serper API key not configured. Go to Admin → Settings → Lead Discovery and add your SERPER_API_KEY from serper.dev. This is required for real lead discovery.",
        503
      );
    }

    // ── Step 2: Build real search query ──
    let targetStr = "";
    if (targetCriteria && typeof targetCriteria === "object") {
      const vals = Object.values(targetCriteria).filter((v) => typeof v === "string" && (v as string).trim());
      targetStr = (vals as string[]).join(" ");
    }
    const query = `${targetStr ? targetStr + " in " : ""}${geographicFocus}`;

    console.log(`[discover-leads] Querying Serper Places: "${query}"`);

    // ── Step 3: Fetch REAL businesses from Google Places via Serper ──
    const serperRes = await fetch("https://google.serper.dev/places", {
      method: "POST",
      headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, gl: "us", hl: "en", num: 20 }),
    });

    if (!serperRes.ok) {
      const errText = await serperRes.text();
      console.error("[discover-leads] Serper API error:", serperRes.status, errText);
      return errorResponse(
        `Serper API returned an error (${serperRes.status}). Check your API key or try again.`,
        502
      );
    }

    const serperData = await serperRes.json();
    const places = serperData.places || [];

    console.log(`[discover-leads] Serper returned ${places.length} real places.`);

    if (places.length === 0) {
      return errorResponse(
        "No businesses found for your search criteria. Try broadening the industry or geographic focus.",
        404
      );
    }

    // ── Step 4: Use AI ONLY to map real Serper data into lead schema ──
    // The AI gets the REAL data — it must never invent businesses
    const data = await callAI({
      systemPrompt: `You are a data formatter. You will receive a list of REAL businesses from Google Places (via Serper API). Your ONLY job is to convert them into the structured lead format.

CRITICAL RULES:
- NEVER invent or add businesses not in the provided list
- NEVER fabricate email addresses, phone numbers, or contact names
- Copy phone, address, rating, and review_count exactly from the Serper data
- Only leave a field null if it is genuinely not present in the source data
- contact_name and contact_role should be null unless available in the data
- Infer industry from the business type/category in the Serper data
- Estimate size_estimate (small/medium/large/enterprise) based on review_count and description`,
      userContent: `REAL Google Places data — format these into leads:
${JSON.stringify(places.slice(0, 20), null, 2)}

Campaign target criteria: ${JSON.stringify(targetCriteria)}
Geographic focus: ${geographicFocus}`,
      tools: [{
        type: "function",
        function: {
          name: "return_leads",
          description: "Return formatted leads from real Serper data only",
          parameters: {
            type: "object",
            properties: {
              leads: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    business_name: { type: "string" },
                    website: { type: "string" },
                    email: { type: "string" },
                    phone: { type: "string" },
                    address: { type: "string" },
                    city: { type: "string" },
                    region: { type: "string" },
                    country: { type: "string" },
                    industry: { type: "string" },
                    description: { type: "string" },
                    rating: { type: "number" },
                    review_count: { type: "number" },
                    size_estimate: { type: "string", enum: ["small", "medium", "large", "enterprise"] },
                    contact_name: { type: "string" },
                    contact_role: { type: "string" },
                  },
                  required: ["business_name", "city", "industry"],
                },
              },
            },
            required: ["leads"],
          },
        },
      }],
      toolChoice: { type: "function", function: { name: "return_leads" } },
    });

    const parsed = extractToolCallArgs(data);
    const leads = Array.isArray(parsed?.leads) ? parsed.leads : [];

    if (leads.length === 0) {
      return errorResponse("Failed to parse lead data from real search results.", 500);
    }

    console.log(`[discover-leads] Returning ${leads.length} REAL leads from Serper.`);

    return jsonResponse({ leads, count: leads.length, source: "serper_google_places" });
  } catch (e) {
    console.error("discover-leads error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
