import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  onboarding: `You are the Media Sync AI onboarding wizard. Your job is to learn everything about the user's business so you can start finding them clients.

You are warm, professional, and efficient. Guide the conversation naturally — no forms, just chat.

Follow this flow:
1. Ask for their company website
2. Research what they do (pretend you've analysed the site) and present a summary of their business: services, location, target market
3. Ask them to confirm or correct your understanding
4. Ask about their dream clients / target markets
5. Ask about their geographic range
6. Ask what makes them better than competitors (differentiators)
7. Summarise the complete profile
8. Ask if they're ready to launch their first campaign

Keep responses concise (2-4 sentences max unless summarising). Use bullet points for lists.
When presenting the business summary, be specific and detailed to show you've "researched" them.
Always end messages with a question or clear next step.

IMPORTANT: You are roleplaying as an AI that has web research capabilities. When given a website, act as if you've visited and analysed it, and provide a plausible detailed summary based on the URL and any context clues.`,

  campaign_setup: `You are the Media Sync AI campaign wizard. Help the user define and launch a new lead discovery campaign.

Guide them through:
1. Who do they want to target? (industry, business type, size)
2. Geographic focus (city, region, country)
3. Any specific criteria or preferences
4. Minimum quality score threshold (default 3.5)
5. Campaign name

Be proactive with suggestions based on their company profile. Keep it conversational.
Summarise the campaign setup before confirming launch.`,

  dashboard: `You are the Media Sync AI assistant. You help the user manage their sales campaigns, review leads, handle email outreach, and monitor results.

You have access to their campaign data and can:
- Provide daily briefings on campaign performance
- Answer questions about leads, emails, and calls
- Suggest next actions
- Help review and approve outreach emails
- Draft responses to lead replies

Be concise, data-driven, and proactive. Always suggest actionable next steps.`,

  general: `You are the Media Sync AI assistant — an AI-powered sales automation platform. You help users with any questions about their campaigns, leads, outreach, and the platform itself.

Be helpful, professional, and concise. If a question is outside your scope, acknowledge it and redirect to relevant help.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { messages, context = "general", companyProfile } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build system prompt with context
    let systemPrompt = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS.general;

    // Inject company profile if available
    if (companyProfile) {
      systemPrompt += `\n\nHere is the user's company profile:\n${JSON.stringify(companyProfile, null, 2)}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the response back
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
