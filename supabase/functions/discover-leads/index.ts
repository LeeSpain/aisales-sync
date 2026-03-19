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
    if (isKilled) {
      return errorResponse("AI operations are currently disabled by admin.", 503);
    }

    const { campaignId, companyProfile, targetCriteria, geographicFocus } = await req.json();

    if (!campaignId || !targetCriteria || !geographicFocus) {
      return errorResponse("Missing required params: campaignId, targetCriteria, geographicFocus", 400);
    }

    const data = await callAI({
      systemPrompt: `You are a lead discovery assistant. Based on the target criteria and geographic focus, generate a realistic list of up to 10 business leads that would match the profile. Each lead should have plausible business details.
Return ONLY function-call JSON with fields: business_name, website, email, phone, address, city, region, country, industry, description, rating (1-5), review_count, size_estimate (small/medium/large/enterprise), contact_name, contact_role.`,
      userContent: `CampaignId: ${campaignId}
Target: ${JSON.stringify(targetCriteria)}
Geographic Focus: ${geographicFocus}
Company Profile: ${JSON.stringify(companyProfile)}`,
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
      return errorResponse("No companies found for the selected criteria. Broaden targeting and retry.", 404);
    }

    return jsonResponse({ leads, count: leads.length, source: "ai_discovery" });
  } catch (e) {
    console.error("discover-leads error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
