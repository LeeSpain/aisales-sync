import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { lead, companyProfile, tone = "professional" } = await req.json();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert sales email writer. Write a personalised outreach email from the company to the lead. The email should:
- Reference something specific about the lead's business
- Be ${tone} in tone
- Be concise (150-250 words)
- Include a clear call to action
- Not be pushy or salesy
- Feel like a human wrote it`,
          },
          {
            role: "user",
            content: `Company: ${JSON.stringify(companyProfile)}\n\nLead: ${JSON.stringify(lead)}\n\nWrite a personalised outreach email.`,
          },
        ],
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
        tool_choice: { type: "function", function: { name: "compose_email" } },
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Email generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let email = { subject: "", body: "" };

    if (toolCall?.function?.arguments) {
      email = JSON.parse(toolCall.function.arguments);
    }

    return new Response(JSON.stringify(email), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-outreach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
