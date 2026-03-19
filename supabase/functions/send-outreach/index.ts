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
      .from("outreach_emails")
      .select("*, leads(*)")
      .eq("id", message_id)
      .maybeSingle();

    if (msgError) throw msgError;
    if (!message) return errorResponse("Outreach message not found", 404);

    const lead = message.leads;
    if (!lead) return errorResponse("Associated lead not found", 404);

    // 2. Fetch email config for the company
    const { data: emailConfig } = await sb
      .from("email_config")
      .select("*")
      .eq("company_id", lead.company_id)
      .maybeSingle();

    // 3. Determine recipient email
    const recipientEmail = lead.contact_email || lead.email;
    const channel = message.channel || "email";

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
      .from("outreach_emails")
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
