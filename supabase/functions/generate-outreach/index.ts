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
    const services = JSON.stringify(companyProfile?.services || []);
    const sellingPoints = JSON.stringify(companyProfile?.selling_points || []);
    const pricingSummary = companyProfile?.pricing_summary || "";
    const leadName = lead?.contact_name?.split(" ")[0] || "";
    const leadBiz = lead?.business_name || "their business";
    const leadIndustry = lead?.industry || "";
    const leadCity = lead?.city || lead?.region || "";
    const leadRole = lead?.contact_role || "";
    const leadDesc = lead?.description || "";
    const webSnippets = lead?.web_snippets || lead?.research_data?.services_offered || [];
    const leadWebsite = lead?.website || "";

    const data = await callAI({
      systemPrompt: `You are an expert sales email writer for ${companyName}. Write a personalised outreach email.

ABOUT THE SENDER (${companyName}):
- Services: ${services}
- Selling points: ${sellingPoints}
- Pricing: ${pricingSummary || "Not specified"}
- Description: ${companyProfile?.description || ""}

RULES:
- Tone: ${tone} (${tone === "formal" ? "no contractions, polished language" : tone === "casual" ? "conversational, relaxed" : tone === "friendly" ? "warm, approachable" : "clean and direct"})
- ${leadName ? `Address them as "${leadName}"` : `Address to "the team at ${leadBiz}"`}
- ${leadRole ? `Reference their role as ${leadRole}` : ""}
- Reference something SPECIFIC about their business: ${leadDesc || "use details from web snippets below"}
- ${leadCity ? `Mention their location (${leadCity}) if relevant` : ""}
- ${webSnippets.length > 0 ? `Use these details from their website: ${JSON.stringify(webSnippets)}` : ""}
- ${leadWebsite ? `Their website: ${leadWebsite}` : ""}
- Mention 1-2 specific services from ${companyName} that are relevant to THIS lead
- ${sellingPoints !== "[]" ? `Work in a selling point: ${sellingPoints}` : ""}
- Be concise (150-250 words)
- Include a clear call to action (meeting, call, or demo)
- Not be pushy or salesy — feel like a human wrote it
- NEVER use generic filler like "I came across your company" — be SPECIFIC`,
      userContent: `Lead details:\n${JSON.stringify(lead)}\n\nWrite a personalised outreach email.`,
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
