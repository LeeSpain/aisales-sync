import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") { return new Response("ok", { headers: corsHeaders }); }
    try {
        const { lead_id } = await req.json();
        // TODO: Query Apollo.io with company name + domain -> get decision-maker contacts -> match against target_criteria -> store best match
        return new Response(JSON.stringify({ status: "enriched" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }
});
