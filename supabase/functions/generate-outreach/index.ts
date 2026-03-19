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
    if (!checkRateLimit("generate-outreach", 30, 60_000)) {
      return errorResponse("Rate limit exceeded. Please try again in a moment.", 429);
    }

    const sb = getSupabaseClient();
    if (await checkDeadSwitch(sb)) {
      return errorResponse("AI operations are currently disabled by admin.", 503);
    }

    const { lead, companyProfile, tone = "professional" } = await req.json();
    if (!lead || !companyProfile) {
      return errorResponse("Missing lead or companyProfile in request body", 400);
    }

    // Build the personalisation context from all available real data
    const recipientName = lead.contact_name
      ? lead.contact_name.split(" ")[0]  // First name only
      : null;

    const recipientRole = lead.contact_role || null;
    const businessName = lead.business_name || "your company";
    const city = lead.city || lead.region || "your area";

    // Use web snippets for specific personalisation hooks
    const webSnippets: string[] = lead.web_snippets || lead.services_found || [];
    const topSnippet = webSnippets[0] || "";

    // Extract a specific detail for personalisation (what they do, an achievement, a service)
    const personalisationHook = topSnippet.length > 30
      ? `Based on your work: "${topSnippet.slice(0, 120).trim()}..."`
      : lead.description
        ? `As a ${lead.industry || "business"} in ${city}`
        : `As a ${lead.industry || "business"} based in ${city}`;

    const senderCompany = companyProfile.name || "our company";
    const senderServices = Array.isArray(companyProfile.services)
      ? companyProfile.services.slice(0, 3).join(", ")
      : companyProfile.services || "our services";

    const toneGuide: Record<string, string> = {
      professional: "formal yet warm, like a trusted peer",
      friendly: "conversational and approachable, like you already know them",
      assertive: "confident and direct, focusing on clear value and outcomes",
      consultative: "thoughtful and curious, leading with a question about their challenges",
    };
    const toneDescription = toneGuide[tone] || toneGuide.professional;

    const systemPrompt = `You are an expert B2B sales email writer. Write personalised cold outreach emails that feel genuine, not spammy.

Rules:
- Tone: ${toneDescription}
- Length: 120–180 words maximum (short = higher response rates)
- ALWAYS open with something SPECIFIC about the lead's business — use the personalisation hook provided
- Address the recipient by first name if available
- ONE clear, low-friction CTA (e.g. "Would a 20-minute call make sense?")
- NEVER make up facts not provided — only reference real data given
- No bullet points, no headers, no bold text — this is plain conversational email
- Sign off naturally (e.g. "Best," or "Warm regards,")
- No "I hope this email finds you well" or generic openers
- The email must reference something SPECIFIC about THEIR business, not just your services`;

    const userContent = `Write a cold outreach email with these details:

RECIPIENT:
  Name: ${recipientName || "(no name — address as 'Hi there' or use their business name)"}
  Role: ${recipientRole || "decision maker"}
  Business: ${businessName}
  Industry: ${lead.industry || "business"}
  Location: ${city}
  Website: ${lead.website || "N/A"}
  Rating: ${lead.rating ? `${lead.rating}/5 (${lead.review_count || 0} reviews)` : "N/A"}

PERSONALISATION HOOK (use this to open with something specific):
  ${personalisationHook}

SENDER:
  Company: ${senderCompany}
  Services: ${senderServices}
  Value proposition: ${Array.isArray(companyProfile.unique_selling_points) ? companyProfile.unique_selling_points[0] || "helping businesses grow" : "helping businesses grow"}

Write the email now. Keep it under 180 words. Make it feel like it was written specifically for ${businessName}.`;

    const data = await callAI({
      systemPrompt,
      userContent,
      tools: [{
        type: "function",
        function: {
          name: "compose_email",
          description: "Return the personalised outreach email",
          parameters: {
            type: "object",
            properties: {
              subject: {
                type: "string",
                description: "Compelling subject line (6–10 words, not salesy, ideally sounds personal)",
              },
              body: {
                type: "string",
                description: "Email body — plain text, 120–180 words, personalised opener, clear CTA",
              },
              personalisation_used: {
                type: "string",
                description: "What specific fact about the lead you used to personalise this email",
              },
            },
            required: ["subject", "body", "personalisation_used"],
          },
        },
      }],
      toolChoice: { type: "function", function: { name: "compose_email" } },
    });

    const email = extractToolCallArgs(data);
    if (!email || !email.subject || !email.body) {
      return errorResponse("AI failed to generate email content", 500);
    }

    return jsonResponse(email);
  } catch (e) {
    console.error("generate-outreach error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
