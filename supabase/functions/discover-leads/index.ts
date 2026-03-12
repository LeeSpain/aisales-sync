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

    // Use Serper API to get real Google Places businesses first
    const serperKey = Deno.env.get("SERPER_API_KEY");
    let realPlacesContent = "";
    
    if (serperKey) {
      try {
        let targetStr = "";
        if (targetCriteria && typeof targetCriteria === "object") {
           targetStr = Object.values(targetCriteria).filter((v) => typeof v === "string").join(" ");
        }
        const query = `${targetStr ? targetStr + " in " : ""}${geographicFocus || "USA"}`;
        
        const res = await fetch("https://google.serper.dev/places", {
          method: "POST",
          headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
          body: JSON.stringify({ q: query, gl: "us", hl: "en" })
        });
        
        if (res.ok) {
          const json = await res.json();
          if (json.places && json.places.length > 0) {
            realPlacesContent = `\n\nCRITICAL: You MUST use the following REAL Google Places results. DO NOT invent businesses. Extract all fields available.\n${JSON.stringify(json.places.slice(0, 15))}`;
          }
        } else {
          console.error("Serper API Error:", await res.text());
        }
      } catch (e) {
        console.error("Failed to fetch from Serper:", e);
      }
    }

    if (!realPlacesContent) {
      realPlacesContent = `\n\nWARNING: Real search failed. Generate highly realistic businesses that match the criteria.`;
    }

    const data = await callAI({
      systemPrompt: `You are a lead discovery engine. Convert the provided REAL business data into a JSON array of leads. Return a JSON array of up to 15 leads with fields: business_name, website, email, phone, address, city, region, country, industry, description, rating (1-5), review_count, size_estimate (small/medium/large/enterprise), contact_name, contact_role. Extract city, region and industry from the real data. Leave email or contact_name null if not available. Return ONLY the JSON array, no markdown.`,
      userContent: `Target: ${JSON.stringify(targetCriteria)}\nGeographic Focus: ${geographicFocus}\nCompany Profile: ${JSON.stringify(companyProfile)}${realPlacesContent}`,
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
