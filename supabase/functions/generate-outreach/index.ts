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
      systemPrompt: `You are an expert sales email writer. Write a personalised outreach email from the company to the lead. The email should:
- Reference something specific about the lead's business
- Be ${tone} in tone
- Be concise (150-250 words)
- Include a clear call to action
- Not be pushy or salesy
- Feel like a human wrote it`,
      userContent: `Company: ${JSON.stringify(companyProfile)}\n\nLead: ${JSON.stringify(lead)}\n\nWrite a personalised outreach email.`,
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
