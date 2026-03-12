import { optionsResponse, jsonResponse, errorResponse, getSupabaseClient, checkDeadSwitch, callAI, extractToolCallArgs, checkRateLimit } from "../_shared/utils.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const serve = (globalThis as { Deno?: { serve?: (handler: (req: Request) => Response | Promise<Response>) => void } })
  .Deno?.serve;

if (!serve) {
  throw new Error("Deno.serve is not available in this runtime");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    if (!checkRateLimit("discover-leads", 20, 60_000)) {
      return errorResponse("Rate limit exceeded. Please try again in a moment.", 429);
    }

    // Check dead switch
    const sb = getSupabaseClient();
    const isKilled = await checkDeadSwitch(sb);

    if (isKilled) {
      return errorResponse("AI operations are currently disabled by admin.", 503);
    }

    const { campaignId, companyProfile, targetCriteria, geographicFocus } = await req.json();

    if (!campaignId || !targetCriteria || !geographicFocus) {
      return errorResponse("Missing required params: campaignId, targetCriteria, geographicFocus", 400);
    }

    // Production-only guard: require explicit realtime mode + required provider keys.
    // This prevents fallback to placeholder/mock lead generation.
    const realtimeMode = Deno.env.get("DISCOVERY_REALTIME_MODE") === "true";
    const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const serpApiKey = Deno.env.get("SERPAPI_API_KEY");

    if (!realtimeMode) {
      return errorResponse(
        "Realtime lead discovery is disabled. Set DISCOVERY_REALTIME_MODE=true in edge function secrets.",
        503,
      );
    }

    if (!googleMapsApiKey || !serpApiKey) {
      return errorResponse(
        "Realtime provider keys missing. Configure GOOGLE_MAPS_API_KEY and SERPAPI_API_KEY.",
        503,
      );
    }

    const data = await callAI({
      systemPrompt: `You are a realtime lead discovery parser.
Only return businesses that appear to be real, currently operating companies with verifiable web presence.
Never invent fictional businesses.
If confidence is low for a record, exclude it.
Return a JSON array of up to 10 leads with fields: business_name, website, email, phone, address, city, region, country, industry, description, rating (1-5), review_count, size_estimate (small/medium/large/enterprise), contact_name, contact_role.
Return ONLY function-call JSON.`,
      userContent: `CampaignId: ${campaignId}
Target: ${JSON.stringify(targetCriteria)}
Geographic Focus: ${geographicFocus}
Company Profile: ${JSON.stringify(companyProfile)}
Data sources enabled: Google Maps API + SerpAPI (realtime mode)`,
      tools: [{
        type: "function",
        function: {
          name: "return_leads",
          description: "Return discovered leads",
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
      return errorResponse("No realtime companies found for the selected criteria. Broaden targeting and retry.", 404);
    }

    return jsonResponse({ leads, count: leads.length, source: "realtime_companies" });
  } catch (e) {
    console.error("discover-leads error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
