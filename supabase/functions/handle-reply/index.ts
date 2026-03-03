import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") { return new Response("ok", { headers: corsHeaders }); }
    try {
        const { reply_data } = await req.json();
        // TODO: Match to outreach_message -> create inbound_reply -> AI classifies intent -> auto-handle per autonomy level
        return new Response(JSON.stringify({ status: "processed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }
});
