import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Check dead switch
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: deadSwitch } = await sb
      .from("ai_config")
      .select("is_active")
      .eq("provider", "dead_switch")
      .eq("purpose", "system_setting")
      .maybeSingle();

    if (deadSwitch?.is_active) {
      return new Response(JSON.stringify({ error: "AI operations are currently disabled by admin." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lead, companyProfile } = await req.json();

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
            content: `You are a lead scoring AI. Score a business lead from 1.0 to 5.0 based on how well they match the company's ideal client profile. Consider: industry fit, size, location, service needs, budget indicators. Return structured output.`,
          },
          {
            role: "user",
            content: `Company Profile: ${JSON.stringify(companyProfile)}\n\nLead to score: ${JSON.stringify(lead)}`,
          },
        ],
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
        tool_choice: { type: "function", function: { name: "score_lead" } },
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Scoring failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let result = { score: 0, reasoning: "", qualified: false };

    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("score-lead error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
