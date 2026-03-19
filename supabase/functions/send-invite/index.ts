import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { optionsResponse, jsonResponse, errorResponse, getSupabaseClient, checkRateLimit } from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return optionsResponse();
  }

  try {
    if (!checkRateLimit("send-invite", 20, 60_000)) {
      return errorResponse("Rate limit exceeded. Please try again in a moment.", 429);
    }

    const { invite_id } = await req.json();
    if (!invite_id) throw new Error("invite_id is required");

    const supabase = getSupabaseClient();

    // Fetch the invite
    const { data: invite, error: invErr } = await supabase
      .from("invitations")
      .select("*")
      .eq("id", invite_id)
      .single();

    if (invErr || !invite) {
      throw new Error("Invitation not found");
    }

    const channels = (invite.channels as string[]) || ["email"];
    const signupUrl = `${Deno.env.get("SITE_URL") || "https://aisales-sync.vercel.app"}/auth?invite=${invite.id}`;
    const results: Record<string, string> = {};

    // ─── Send via Email (SendGrid) ───
    if (channels.includes("email")) {
      const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
      if (sendgridKey) {
        try {
          const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sendgridKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [
                {
                  to: [{ email: invite.email, name: invite.name }],
                  subject: "You're invited to AI Sales Sync",
                },
              ],
              from: {
                email: Deno.env.get("SENDGRID_FROM_EMAIL") || "hello@aisalessync.com",
                name: "AI Sales Sync",
              },
              content: [
                {
                  type: "text/html",
                  value: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
                      <h1 style="font-size: 24px; color: #111;">Hi ${invite.name},</h1>
                      <p style="font-size: 16px; color: #555; line-height: 1.6;">
                        You've been invited to join <strong>AI Sales Sync</strong> — the AI-powered sales platform that finds, qualifies, and contacts leads for you.
                      </p>
                      <a href="${signupUrl}" style="display: inline-block; margin: 24px 0; padding: 14px 28px; background: linear-gradient(135deg, #6366f1, #06b6d4); color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px;">
                        Accept Invitation
                      </a>
                      <p style="font-size: 14px; color: #888;">
                        Or copy this link: <a href="${signupUrl}" style="color: #6366f1;">${signupUrl}</a>
                      </p>
                    </div>
                  `,
                },
              ],
            }),
          });
          results.email = res.ok ? "sent" : `failed (${res.status})`;
        } catch (e) {
          results.email = `error: ${e.message}`;
        }
      } else {
        results.email = "skipped (no SENDGRID_API_KEY)";
      }
    }

    // ─── Send via WhatsApp (Meta Cloud API) ───
    if (channels.includes("whatsapp") && invite.mobile) {
      const waToken = Deno.env.get("WHATSAPP_API_TOKEN");
      const waPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

      if (waToken && waPhoneId) {
        try {
          // Clean the mobile number — strip spaces, dashes, keep +
          const cleanMobile = invite.mobile.replace(/[\s\-()]/g, "");

          const res = await fetch(
            `https://graph.facebook.com/v18.0/${waPhoneId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${waToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: cleanMobile,
                type: "text",
                text: {
                  body: `Hi ${invite.name}! You've been invited to join AI Sales Sync — the AI-powered sales platform.\n\nClick here to get started: ${signupUrl}`,
                },
              }),
            }
          );
          results.whatsapp = res.ok ? "sent" : `failed (${res.status})`;
        } catch (e) {
          results.whatsapp = `error: ${e.message}`;
        }
      } else {
        results.whatsapp = "skipped (WhatsApp not configured)";
      }
    }

    // Update invite status
    await supabase
      .from("invitations")
      .update({ status: "sent" })
      .eq("id", invite_id);

    return jsonResponse({ success: true, results });
  } catch (error) {
    return errorResponse(error.message, 400);
  }
});
