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

    const data = await callAI({
      systemPrompt: `You are an expert B2B sales email writer for ${companyProfile?.name || "the company"}.

COMPANY CONTEXT (use this to sell):
- Services: ${(companyProfile?.services || []).join(", ") || "not specified"}
- Selling Points: ${(companyProfile?.unique_selling_points || companyProfile?.selling_points || []).join(", ") || "not specified"}
- Target Markets: ${(companyProfile?.target_markets || []).join(", ") || "not specified"}

RULES:
- Reference something SPECIFIC about the lead's business (their industry, website snippets, recent activity)
- Explain how ONE of the company's services solves a specific problem the lead likely has
- Be ${tone} in tone
- Be concise (120-180 words)
- Include a clear, low-commitment call to action (e.g. "Would a 15-min call make sense?")
- Not be pushy or salesy — feel like a human wrote it
- Use the lead's contact_name if available, otherwise use their business name
- Never use placeholder text like [Name] or {Company}`,
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
