import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") { return new Response("ok", { headers: corsHeaders }); }
    try {
        const { message_id } = await req.json();
        // TODO: Send via email provider -> track opens/clicks -> update status. (Or flag LinkedIn for manual send)
        return new Response(JSON.stringify({ status: "sent" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }
});
