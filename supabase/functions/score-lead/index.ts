import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { optionsResponse, jsonResponse, errorResponse, getSupabaseClient, checkDeadSwitch, callAI, extractToolCallArgs, checkRateLimit } from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    if (!checkRateLimit("score-lead", 60, 60_000)) {
      return errorResponse("Rate limit exceeded. Please try again in a moment.", 429);
    }

    // Check dead switch
    const sb = getSupabaseClient();
    const isKilled = await checkDeadSwitch(sb);

    if (isKilled) {
      return errorResponse("AI operations are currently disabled by admin.", 503);
    }

    const { lead, companyProfile } = await req.json();

    let result: { score: number; reasoning: string; qualified: boolean };
    try {
      const data = await callAI({
        systemPrompt: `You are a lead scoring AI for ${companyProfile?.name || "the company"}.

COMPANY CONTEXT:
- Name: ${companyProfile?.name || "Unknown"}
- Industry: ${companyProfile?.industry || "Unknown"}
- Services: ${JSON.stringify(companyProfile?.services || [])}
- Selling points: ${JSON.stringify(companyProfile?.selling_points || [])}
- Target markets: ${JSON.stringify(companyProfile?.target_markets || [])}
- Description: ${companyProfile?.description || ""}
- Geographic range: ${companyProfile?.geographic_range || ""}

Score the lead 1.0–5.0 based on:
- Industry fit: Does the lead's industry match the company's target markets?
- Service need: Would the lead plausibly need the company's services?
- Size fit: Is the lead the right size (budget capacity)?
- Location fit: Is the lead in a serviceable geography?
- Quality signals: Website quality, reviews, online presence
- Urgency: Any indicators they need help now?

Score HIGH (4-5): industry matches target markets, right size, in geographic range, needs the services.
Score LOW (1-2): completely unrelated industry, wrong size, outside geographic range.

5.0 = perfect ICP match, 1.0 = completely wrong fit.`,
        userContent: `Lead to score:\n${JSON.stringify(lead)}`,
        tools: [{
          type: "function",
          function: {
            name: "score_lead",
            description: "Return a score and reasoning for the lead",
            parameters: {
              type: "object",
              properties: {
                score: { type: "number", description: "Score from 1.0 to 5.0" },
                reasoning: { type: "string", description: "Why this score was given" },
                qualified: { type: "boolean", description: "Whether the lead qualifies (score >= 3.5)" },
              },
              required: ["score", "reasoning", "qualified"],
            },
          },
        }],
        toolChoice: { type: "function", function: { name: "score_lead" } },
      });
      const parsed = extractToolCallArgs(data);
      result = parsed
        ? { score: (parsed.score as number) ?? 3.0, reasoning: (parsed.reasoning as string) ?? "", qualified: (parsed.qualified as boolean) ?? true }
        : { score: 3.0, reasoning: "Auto-scored — AI returned empty result", qualified: true };
    } catch (aiErr) {
      console.error("score-lead AI call failed:", aiErr);
      result = { score: 3.0, reasoning: "Auto-scored — review manually", qualified: true };
    }

    return jsonResponse(result);
  } catch (e) {
    console.error("score-lead error:", e);
    return jsonResponse({ score: 3.0, reasoning: "Auto-scored — scoring service error", qualified: true });
  }
});
