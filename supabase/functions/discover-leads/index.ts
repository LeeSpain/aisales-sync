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

    const { campaignId, companyProfile, targetCriteria, geographicFocus } = await req.json();

    // Use AI to generate mock lead discovery results
    // In production, this would call Google Places API + SerpAPI
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
            content: `You are a lead discovery engine. Given target criteria and geographic focus, generate realistic business leads. Return a JSON array of 10 leads with fields: business_name, website, email, phone, address, city, region, country, industry, description, rating (1-5), review_count, size_estimate (small/medium/large/enterprise), contact_name, contact_role. Make them realistic businesses that would match the criteria. Return ONLY the JSON array, no markdown.`,
          },
          {
            role: "user",
            content: `Target: ${JSON.stringify(targetCriteria)}\nGeographic Focus: ${geographicFocus}\nCompany Profile: ${JSON.stringify(companyProfile)}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_leads",
            description: "Return discovered leads",
            parameters: {
              type: "object",
              properties: {
                leads: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      business_name: { type: "string" },
                      website: { type: "string" },
                      email: { type: "string" },
                      phone: { type: "string" },
                      address: { type: "string" },
                      city: { type: "string" },
                      region: { type: "string" },
                      country: { type: "string" },
                      industry: { type: "string" },
                      description: { type: "string" },
                      rating: { type: "number" },
                      review_count: { type: "number" },
                      size_estimate: { type: "string", enum: ["small", "medium", "large", "enterprise"] },
                      contact_name: { type: "string" },
                      contact_role: { type: "string" },
                    },
                    required: ["business_name", "city", "industry"],
                  },
                },
              },
              required: ["leads"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_leads" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Lead discovery failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let leads = [];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      leads = parsed.leads || [];
    }

    return new Response(JSON.stringify({ leads, count: leads.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("discover-leads error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
