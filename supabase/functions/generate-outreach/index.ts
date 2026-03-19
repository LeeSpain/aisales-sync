import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { optionsResponse, jsonResponse, errorResponse, getSupabaseClient, checkDeadSwitch, callAI, extractToolCallArgs, checkRateLimit } from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    if (!checkRateLimit("generate-outreach", 30, 60_000)) {
      return errorResponse("Rate limit exceeded. Please try again in a moment.", 429);
    }

    // Check dead switch
    const sb = getSupabaseClient();
    const isKilled = await checkDeadSwitch(sb);

    if (isKilled) {
      return errorResponse("AI operations are currently disabled by admin.", 503);
    }

    const { lead, companyProfile, tone = "professional" } = await req.json();

    const companyName = companyProfile?.name || "our company";
    const services = companyProfile?.services || [];
    const sellingPoints = companyProfile?.selling_points || [];
    const pricingSummary = companyProfile?.pricing_summary || "";
    const leadName = lead?.contact_name?.split(" ")[0] || "";
    const leadBiz = lead?.business_name || "their business";
    const leadIndustry = lead?.industry || "";
    const leadCity = lead?.city || lead?.region || "";
    const leadRole = lead?.contact_role || "";
    const leadDesc = lead?.description || "";
    const webSnippets = lead?.web_snippets || lead?.services_found || [];
    const leadWebsite = lead?.website || "";

    const toneGuide = tone === "formal" ? "no contractions, polished language"
      : tone === "casual" ? "conversational, relaxed"
      : tone === "friendly" ? "warm, approachable"
      : "clean and direct";

    const data = await callAI({
      systemPrompt: `You are an expert B2B sales email writer for ${companyName}.

COMPANY CONTEXT (use this to sell):
- Services: ${Array.isArray(services) ? services.join(", ") : JSON.stringify(services)}
- Selling Points: ${Array.isArray(sellingPoints) ? sellingPoints.join(", ") : JSON.stringify(sellingPoints)}
- Target Markets: ${(companyProfile?.target_markets || []).join?.(", ") || "not specified"}
- Pricing: ${pricingSummary || "not specified"}
- Description: ${companyProfile?.description || ""}

LEAD DETAILS TO PERSONALISE WITH:
- Business: ${leadBiz}${leadIndustry ? ` (${leadIndustry})` : ""}
- ${leadCity ? `Location: ${leadCity}` : ""}
- ${leadRole ? `Contact role: ${leadRole}` : ""}
- ${leadDesc ? `About them: ${leadDesc}` : ""}
- ${webSnippets.length > 0 ? `From their website: ${JSON.stringify(webSnippets)}` : ""}
- ${leadWebsite ? `Website: ${leadWebsite}` : ""}

RULES:
- Tone: ${tone} (${toneGuide})
- ${leadName ? `Address them as "${leadName}"` : `Address to "the team at ${leadBiz}"`}
- Reference something SPECIFIC about their business — never generic filler
- Explain how ONE of ${companyName}'s services solves a specific problem the lead likely has
- ${sellingPoints.length > 0 ? `Work in a selling point naturally` : ""}
- Be concise (120-180 words)
- Include a clear, low-commitment call to action (e.g. "Would a 15-min call make sense?")
- Not be pushy or salesy — feel like a human wrote it
- Never use placeholder text like [Name] or {Company}
- NEVER use "I came across your company" or similar generic openers`,
      userContent: `Lead to write to:\n${JSON.stringify(lead)}\n\nWrite a personalised outreach email.`,
      tools: [{
        type: "function",
        function: {
          name: "compose_email",
          description: "Return the email subject and body",
          parameters: {
            type: "object",
            properties: {
              subject: { type: "string", description: "Email subject line" },
              body: { type: "string", description: "Email body text" },
            },
            required: ["subject", "body"],
          },
        },
      }],
      toolChoice: { type: "function", function: { name: "compose_email" } },
    });

    const email = extractToolCallArgs(data) || { subject: "", body: "" };

    return jsonResponse(email);
  } catch (e) {
    console.error("generate-outreach error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
