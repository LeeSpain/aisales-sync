import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getSupabaseClient,
  checkDeadSwitch,
  optionsResponse,
  jsonResponse,
  errorResponse,
  logActivity,
} from "../_shared/utils.ts";
import { validateRequired, validateUUID } from "../_shared/validators.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Email verification via Hunter.io
// ─────────────────────────────────────────────────────────────────────────────

interface VerificationResult {
  status: "valid" | "invalid" | "risky" | "unknown";
  score: number;
}

async function verifyEmailWithHunter(email: string): Promise<VerificationResult> {
  const hunterKey = Deno.env.get("HUNTER_API_KEY");
  if (!hunterKey) {
    console.warn("HUNTER_API_KEY not set — skipping email verification");
    return { status: "unknown", score: 0 };
  }

  try {
    const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${hunterKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error("Hunter API error:", res.status, await res.text());
      return { status: "unknown", score: 0 };
    }

    const json = await res.json();
    const data = json.data;

    // Hunter returns: deliverable, undeliverable, risky, unknown
    const result = data?.result || "unknown";
    const score = data?.score || 0;

    if (result === "deliverable") return { status: "valid", score };
    if (result === "undeliverable") return { status: "invalid", score };
    if (result === "risky") return { status: "risky", score };
    return { status: "unknown", score };
  } catch (err) {
    console.error("Hunter verification failed:", err);
    return { status: "unknown", score: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Block helpers
// ─────────────────────────────────────────────────────────────────────────────

async function blockSend(
  sb: ReturnType<typeof getSupabaseClient>,
  messageId: string,
  leadId: string,
  companyId: string,
  reason: string,
  businessName: string,
) {
  // Update outreach message to blocked
  await sb
    .from("outreach_messages")
    .update({
      status: "blocked",
      blocked_reason: reason,
    })
    .eq("id", messageId);

  // Log the blocked send
  await logActivity(sb, "outreach_blocked", companyId, `Outreach to ${businessName} blocked: ${reason}`, {
    message_id: messageId,
    lead_id: leadId,
    event_type: "outreach_blocked",
    blocked_reason: reason,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const sb = getSupabaseClient();

    const killed = await checkDeadSwitch(sb);
    if (killed) return errorResponse("AI operations are currently disabled by admin.", 503);

    const body = await req.json();
    const validationError = validateRequired(body, ["message_id"]);
    if (validationError) return errorResponse(validationError, 400);

    const { message_id } = body;
    if (!validateUUID(message_id)) return errorResponse("Invalid message_id format", 400);

    // 1. Fetch outreach message with lead details
    const { data: message, error: msgError } = await sb
      .from("outreach_messages")
      .select("*, leads(*)")
      .eq("id", message_id)
      .maybeSingle();

    if (msgError) throw msgError;
    if (!message) return errorResponse("Outreach message not found", 404);

    const lead = message.leads;
    if (!lead) return errorResponse("Associated lead not found", 404);

    // 2. Determine recipient email
    const recipientEmail = lead.contact_email || lead.email;
    const channel = message.channel || "email";

    // ═══════════════════════════════════════════════════════════════════════
    // EMAIL BOUNCE PROTECTION — Pre-send verification checks
    // ═══════════════════════════════════════════════════════════════════════

    if (channel === "email" && recipientEmail) {
      const verificationStatus = lead.email_verification_status as string | null;
      const contactConfidence = lead.contact_confidence as string | null;

      // CHECK 1: Email marked as invalid — hard block
      if (verificationStatus === "invalid") {
        const reason = "Email marked as invalid — re-enrich this lead first";
        await blockSend(sb, message_id, lead.id, lead.company_id, reason, lead.business_name);
        return jsonResponse({
          success: false,
          blocked: true,
          reason,
          message_id,
          lead_id: lead.id,
        }, 422);
      }

      // CHECK 2: Risky email + guessed contact — block
      if (verificationStatus === "risky" && contactConfidence === "guessed") {
        const reason = "Email confidence too low — verify before sending";
        await blockSend(sb, message_id, lead.id, lead.company_id, reason, lead.business_name);
        return jsonResponse({
          success: false,
          blocked: true,
          reason,
          message_id,
          lead_id: lead.id,
        }, 422);
      }

      // CHECK 3: No verification status yet — verify on the fly
      if (verificationStatus === null) {
        const result = await verifyEmailWithHunter(recipientEmail);

        // Store the verification result on the lead
        await sb.from("leads").update({
          email_verification_status: result.status,
        }).eq("id", lead.id);

        // If invalid after verification — block
        if (result.status === "invalid") {
          const reason = "Email verified as invalid by Hunter.io — re-enrich this lead first";
          await blockSend(sb, message_id, lead.id, lead.company_id, reason, lead.business_name);
          return jsonResponse({
            success: false,
            blocked: true,
            reason,
            message_id,
            lead_id: lead.id,
          }, 422);
        }

        // If risky + guessed — block
        if (result.status === "risky" && contactConfidence === "guessed") {
          const reason = "Email verified as risky with low confidence — verify before sending";
          await blockSend(sb, message_id, lead.id, lead.company_id, reason, lead.business_name);
          return jsonResponse({
            success: false,
            blocked: true,
            reason,
            message_id,
            lead_id: lead.id,
          }, 422);
        }

        // valid or unknown with decent confidence — proceed
        console.log(`Email ${recipientEmail} verified: ${result.status} (score: ${result.score})`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // END BOUNCE PROTECTION — proceed to send
    // ═══════════════════════════════════════════════════════════════════════

    // 3. Fetch email config for the company
    const { data: emailConfig } = await sb
      .from("email_config")
      .select("*")
      .eq("company_id", lead.company_id)
      .maybeSingle();

    let sendResult: { status: string; method: string };

    if (channel === "email") {
      // 4. For email channel: try SendGrid, otherwise simulate
      const sendgridApiKey =
        Deno.env.get("SENDGRID_API_KEY") || emailConfig?.api_key_encrypted;

      if (sendgridApiKey && recipientEmail) {
        // Send via SendGrid
        const fromEmail =
          emailConfig?.from_email || emailConfig?.sender_email || "noreply@aisales-sync.com";
        const fromName = emailConfig?.from_name || emailConfig?.sender_name || "Sales Team";

        const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sendgridApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [
              {
                to: [{ email: recipientEmail, name: lead.contact_name || lead.business_name }],
                subject: message.subject || "Hello from our team",
              },
            ],
            from: { email: fromEmail, name: fromName },
            content: [
              {
                type: "text/html",
                value: message.body || message.content || "",
              },
            ],
          }),
        });

        if (!sgResponse.ok) {
          const sgError = await sgResponse.text();
          console.error("SendGrid error:", sgResponse.status, sgError);
          throw new Error("Failed to send email via SendGrid");
        }

        sendResult = { status: "sent", method: "sendgrid" };
      } else {
        // Simulate sending (no API key or no recipient email)
        console.log(
          `Simulated email send to ${recipientEmail || "unknown"} for message ${message_id}`
        );
        sendResult = { status: "sent", method: "simulated" };
      }
    } else {
      // 5. Non-email channels: set to pending manual
      sendResult = { status: "pending_manual", method: channel };
    }

    const now = new Date().toISOString();
    const finalStatus = sendResult.status;

    // 6. Update outreach message status and sent_at
    const { error: updateMsgError } = await sb
      .from("outreach_messages")
      .update({
        status: finalStatus,
        ...(finalStatus === "sent" ? { sent_at: now } : {}),
      })
      .eq("id", message_id);

    if (updateMsgError) throw updateMsgError;

    // 7. Increment campaign emails_sent counter
    if (message.campaign_id && finalStatus === "sent") {
      const { data: campaign } = await sb
        .from("campaigns")
        .select("emails_sent")
        .eq("id", message.campaign_id)
        .maybeSingle();

      if (campaign) {
        await sb
          .from("campaigns")
          .update({ emails_sent: (campaign.emails_sent || 0) + 1 })
          .eq("id", message.campaign_id);
      }
    }

    // 8. Update lead status to "contacted"
    await sb.from("leads").update({ status: "contacted" }).eq("id", lead.id);

    // 9. Log activity
    await logActivity(sb, "outreach_sent", lead.company_id, `Outreach sent to ${lead.business_name || lead.contact_email || "lead"} via ${sendResult.method}`, {
      message_id,
      lead_id: lead.id,
      channel,
      method: sendResult.method,
      status: finalStatus,
    });

    return jsonResponse({
      success: true,
      status: finalStatus,
      method: sendResult.method,
      message_id,
      lead_id: lead.id,
    });
  } catch (e) {
    console.error("send-outreach error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
