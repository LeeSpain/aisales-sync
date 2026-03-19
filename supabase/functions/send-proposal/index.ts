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

function formatProposalHtml(proposal: Record<string, unknown>, company: Record<string, unknown>, lead: Record<string, unknown>): string {
  const companyName = (company.company_name || "Our Company") as string;
  const leadName = (lead.contact_name || lead.business_name || "Valued Client") as string;
  const sections = (proposal.sections || []) as Array<{ heading: string; content: string }>;

  let sectionsHtml = "";
  for (const section of sections) {
    sectionsHtml += `
      <div style="margin-bottom: 24px;">
        <h2 style="color: #1a1a2e; font-size: 18px; margin-bottom: 8px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px;">${escapeHtml(section.heading)}</h2>
        <div style="color: #333; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(section.content)}</div>
      </div>`;
  }

  const dealValue = proposal.deal_value
    ? `<p style="font-size: 14px; color: #555;">Estimated Investment: <strong>$${Number(proposal.deal_value).toLocaleString()}</strong></p>`
    : "";

  const validUntil = proposal.valid_until
    ? `<p style="font-size: 13px; color: #777;">This proposal is valid until ${new Date(proposal.valid_until as string).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.</p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; background-color: #f9f9f9;">
  <div style="background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #4a90d9;">
      <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">${escapeHtml(proposal.title as string || "Business Proposal")}</h1>
      <p style="color: #666; margin: 8px 0 0;">Prepared for ${escapeHtml(leadName)} by ${escapeHtml(companyName)}</p>
    </div>

    <div style="background: #f0f5ff; border-left: 4px solid #4a90d9; padding: 16px; margin-bottom: 24px; border-radius: 0 4px 4px 0;">
      <h3 style="color: #1a1a2e; margin: 0 0 8px;">Executive Summary</h3>
      <p style="color: #333; line-height: 1.6; margin: 0;">${escapeHtml(proposal.executive_summary as string || "")}</p>
    </div>

    ${sectionsHtml}

    <div style="margin-top: 32px; padding-top: 16px; border-top: 2px solid #4a90d9; text-align: center;">
      ${dealValue}
      ${validUntil}
      <p style="font-size: 13px; color: #999; margin-top: 16px;">${escapeHtml(companyName)}</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const sb = getSupabaseClient();

    const killed = await checkDeadSwitch(sb);
    if (killed) return errorResponse("AI operations are currently disabled by admin.", 503);

    const body = await req.json();
    const validationError = validateRequired(body, ["proposal_id"]);
    if (validationError) return errorResponse(validationError, 400);

    const { proposal_id } = body;
    if (!validateUUID(proposal_id)) return errorResponse("Invalid proposal_id format", 400);

    // 1. Fetch proposal with lead and company details
    const { data: proposal, error: propError } = await sb
      .from("proposals")
      .select("*, leads(*)")
      .eq("id", proposal_id)
      .maybeSingle();

    if (propError) throw propError;
    if (!proposal) return errorResponse("Proposal not found", 404);

    const lead = proposal.leads;
    if (!lead) return errorResponse("Associated lead not found", 404);

    const { data: company, error: companyError } = await sb
      .from("companies")
      .select("*")
      .eq("id", proposal.company_id)
      .maybeSingle();

    if (companyError) throw companyError;
    if (!company) return errorResponse("Company not found", 404);

    // 2. Fetch email config for company
    const { data: emailConfig } = await sb
      .from("email_config")
      .select("*")
      .eq("company_id", proposal.company_id)
      .maybeSingle();

    // 3. Format proposal as HTML email
    const htmlContent = formatProposalHtml(proposal, company, lead);
    const recipientEmail = lead.contact_email || lead.email;
    const proposalTitle = proposal.title || "Business Proposal";

    let sendMethod: string;

    // 4. Send via SendGrid if configured
    const sendgridApiKey =
      Deno.env.get("SENDGRID_API_KEY") || emailConfig?.api_key_encrypted;

    if (sendgridApiKey && recipientEmail) {
      const fromEmail =
        emailConfig?.from_email || emailConfig?.sender_email || "noreply@aisales-sync.com";
      const fromName =
        emailConfig?.from_name || emailConfig?.sender_name || company.company_name || "Sales Team";

      const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [
                {
                  email: recipientEmail,
                  name: lead.contact_name || lead.business_name,
                },
              ],
              subject: `Proposal: ${proposalTitle}`,
            },
          ],
          from: { email: fromEmail, name: fromName },
          content: [
            {
              type: "text/html",
              value: htmlContent,
            },
          ],
        }),
      });

      if (!sgResponse.ok) {
        const sgError = await sgResponse.text();
        console.error("SendGrid error:", sgResponse.status, sgError);
        throw new Error("Failed to send proposal email via SendGrid");
      }

      sendMethod = "sendgrid";
    } else {
      // Simulate sending
      console.log(
        `Simulated proposal email to ${recipientEmail || "unknown"} for proposal ${proposal_id}`
      );
      sendMethod = "simulated";
    }

    const now = new Date().toISOString();

    // 5. Update proposal status to "sent" and set sent_at
    const { error: updateError } = await sb
      .from("proposals")
      .update({
        status: "sent",
        sent_at: now,
      })
      .eq("id", proposal_id);

    if (updateError) throw updateError;

    // 6. Increment campaign proposals_sent
    if (proposal.campaign_id) {
      const { data: campaign } = await sb
        .from("campaigns")
        .select("proposals_sent")
        .eq("id", proposal.campaign_id)
        .maybeSingle();

      if (campaign) {
        await sb
          .from("campaigns")
          .update({ proposals_sent: (campaign.proposals_sent || 0) + 1 })
          .eq("id", proposal.campaign_id);
      }
    }

    // 7. Log activity
    await logActivity(
      sb,
      "proposal_sent",
      proposal.company_id,
      `Proposal "${proposalTitle}" sent to ${lead.business_name || lead.contact_email || "lead"} via ${sendMethod}`,
      {
        proposal_id,
        lead_id: lead.id,
        campaign_id: proposal.campaign_id,
        method: sendMethod,
        recipient: recipientEmail,
      }
    );

    return jsonResponse({
      success: true,
      proposal_id,
      status: "sent",
      method: sendMethod,
      sent_at: now,
    });
  } catch (e) {
    console.error("send-proposal error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
