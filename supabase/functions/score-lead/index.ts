import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  optionsResponse,
  jsonResponse,
  errorResponse,
  getSupabaseClient,
  checkDeadSwitch,
  callAI,
  extractToolCallArgs,
  checkRateLimit,
} from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    if (!checkRateLimit("score-lead", 60, 60_000)) {
      return errorResponse("Rate limit exceeded. Please try again in a moment.", 429);
    }

    const sb = getSupabaseClient();
    if (await checkDeadSwitch(sb)) {
      return errorResponse("AI operations are currently disabled by admin.", 503);
    }

    const { lead, companyProfile } = await req.json();
    if (!lead || !companyProfile) {
      return errorResponse("Missing lead or companyProfile in request body", 400);
    }

    // Build a structured, readable prompt instead of raw JSON dump
    const companyBlock = `
COMPANY SELLING:
  Name: ${companyProfile.name || "Unknown"}
  Industry: ${companyProfile.industry || "Various"}
  Services offered: ${Array.isArray(companyProfile.services) ? companyProfile.services.join(", ") : companyProfile.services || "Not specified"}
  Target markets: ${Array.isArray(companyProfile.target_markets) ? companyProfile.target_markets.join(", ") : companyProfile.target_markets || "Not specified"}
  Unique selling points: ${Array.isArray(companyProfile.unique_selling_points) ? companyProfile.unique_selling_points.join(", ") : companyProfile.unique_selling_points || "Not specified"}
`.trim();

    const webContext = lead.web_snippets?.length
      ? `\nWEB RESEARCH SNIPPETS (real data from their website/Google):\n${(lead.web_snippets as string[]).map((s: string, i: number) => `  ${i + 1}. ${s}`).join("\n")}`
      : "";

    const servicesContext = lead.services_found?.length
      ? `\nSERVICES THEY OFFER (from their website):\n${(lead.services_found as string[]).map((s: string) => `  - ${s}`).join("\n")}`
      : "";

    const leadBlock = `
LEAD (potential client):
  Business: ${lead.business_name || "Unknown"}
  Industry / Category: ${lead.industry || lead.category || "Unknown"}
  Location: ${[lead.city, lead.region, lead.country].filter(Boolean).join(", ") || "Unknown"}
  Website: ${lead.website || "Unknown"}
  Description: ${lead.description || "Not available"}
  Rating: ${lead.rating ? `${lead.rating}/5 (${lead.review_count || 0} reviews)` : "Not rated"}
  Business size (estimated): ${lead.size_estimate || "Unknown"}
${webContext}
${servicesContext}
`.trim();

    const data = await callAI({
      systemPrompt: `You are a senior B2B sales qualification expert. Score how well a potential client (lead) matches the company's ideal customer profile.

Use this scoring guide:
  5.0 = Perfect fit — exact industry, clear need for the company's services, decision-making business
  4.0–4.9 = Strong fit — high likelihood of a relevant conversation
  3.0–3.9 = Moderate fit — possible fit but not obvious
  2.0–2.9 = Weak fit — unlikely to buy but not impossible
  1.0–1.9 = Poor fit — wrong industry, too large/small, or no apparent need

Base your score ONLY on the real data provided. Pay special attention to web_snippets — these are from the lead's actual website and are the most reliable signal.

Do NOT score high just because they're a business. Be strict and specific in your reasoning.`,
      userContent: `${companyBlock}\n\n${leadBlock}\n\nScore this lead from 1.0 to 5.0 and explain your reasoning in 2–3 sentences.`,
      tools: [{
        type: "function",
        function: {
          name: "score_lead",
          description: "Return a score and detailed reasoning for the lead qualification",
          parameters: {
            type: "object",
            properties: {
              score: {
                type: "number",
                description: "Score from 1.0 to 5.0 (one decimal place)",
              },
              reasoning: {
                type: "string",
                description: "2–3 sentence explanation of the score, referencing specific details from the lead data",
              },
              key_strengths: {
                type: "array",
                items: { type: "string" },
                description: "Up to 3 reasons this is a good match (leave empty if poor match)",
              },
              key_concerns: {
                type: "array",
                items: { type: "string" },
                description: "Up to 3 concerns or reasons this may not be a fit",
              },
              qualified: {
                type: "boolean",
                description: "Whether the lead qualifies (score >= 3.5)",
              },
            },
            required: ["score", "reasoning", "key_strengths", "key_concerns", "qualified"],
          },
        },
      }],
      toolChoice: { type: "function", function: { name: "score_lead" } },
    });

    const result = extractToolCallArgs(data);
    if (!result) return errorResponse("AI failed to generate a score", 500);

    // Clamp score to valid range
    result.score = Math.min(5.0, Math.max(1.0, Number(result.score) || 3.0));
    result.qualified = result.score >= 3.5;

    return jsonResponse(result);
  } catch (e) {
    console.error("score-lead error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
