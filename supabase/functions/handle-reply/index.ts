import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getSupabaseClient,
  checkDeadSwitch,
  optionsResponse,
  jsonResponse,
  errorResponse,
  callAI,
  extractToolCallArgs,
  logActivity,
} from "../_shared/utils.ts";
import { validateRequired } from "../_shared/validators.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const sb = getSupabaseClient();

    const killed = await checkDeadSwitch(sb);
    if (killed) return errorResponse("AI operations are currently disabled by admin.", 503);

    const body = await req.json();
    const validationError = validateRequired(body, ["from_identifier", "subject", "body"]);
    if (validationError) return errorResponse(validationError, 400);

    const { from_identifier, subject, body: replyBody, channel = "email" } = body;

    // 1. Search outreach_messages joining leads to match from_identifier
    const { data: matchedMessages, error: searchError } = await sb
      .from("outreach_messages")
      .select("*, leads!inner(*)")
      .or(
        `leads.email.ilike.%${from_identifier}%,leads.contact_email.ilike.%${from_identifier}%`
      )
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1);

    if (searchError) {
      console.error("Search error:", searchError);
      // Fallback: try a direct leads search
      const { data: leads } = await sb
        .from("leads")
        .select("id, company_id, business_name, email, contact_email")
        .or(`email.ilike.%${from_identifier}%,contact_email.ilike.%${from_identifier}%`)
        .limit(1);

      if (!leads || leads.length === 0) {
        return errorResponse("No matching lead found for this sender", 404);
      }
    }

    let outreachMessageId: string | null = null;
    let leadId: string | null = null;
    let companyId: string | null = null;
    let campaignId: string | null = null;
    let leadName = "Unknown";

    if (matchedMessages && matchedMessages.length > 0) {
      const match = matchedMessages[0];
      outreachMessageId = match.id;
      leadId = match.leads.id;
      companyId = match.leads.company_id;
      campaignId = match.campaign_id;
      leadName = match.leads.business_name || match.leads.contact_name || from_identifier;
    } else {
      // Fallback: search leads directly
      const { data: leads } = await sb
        .from("leads")
        .select("id, company_id, business_name, contact_name")
        .or(`email.ilike.%${from_identifier}%,contact_email.ilike.%${from_identifier}%`)
        .limit(1);

      if (leads && leads.length > 0) {
        leadId = leads[0].id;
        companyId = leads[0].company_id;
        leadName = leads[0].business_name || leads[0].contact_name || from_identifier;
      } else {
        return errorResponse("No matching lead found for this sender", 404);
      }
    }

    // 2. Call AI to classify intent and draft response
    const aiData = await callAI({
      systemPrompt: `You are an expert sales reply analyst. Classify the intent of an inbound reply to a sales outreach message and draft an appropriate response. Be professional and helpful.`,
      userContent: `From: ${from_identifier}\nSubject: ${subject}\nBody: ${replyBody}\n\nClassify the intent and draft a response.`,
      tools: [
        {
          type: "function",
          function: {
            name: "classify_and_respond",
            description:
              "Classify the reply intent and draft a response",
            parameters: {
              type: "object",
              properties: {
                intent: {
                  type: "string",
                  enum: [
                    "interested",
                    "not_interested",
                    "question",
                    "call_request",
                    "meeting_request",
                    "out_of_office",
                    "referral",
                    "other",
                  ],
                  description: "The classified intent of the reply",
                },
                confidence: {
                  type: "number",
                  description: "Confidence score from 0.0 to 1.0",
                },
                summary: {
                  type: "string",
                  description: "Brief summary of the reply content",
                },
                draft_response: {
                  type: "string",
                  description:
                    "A draft response email appropriate for the intent",
                },
                suggested_action: {
                  type: "string",
                  description:
                    "Recommended next action (e.g., schedule_call, send_proposal, close_lead)",
                },
              },
              required: [
                "intent",
                "confidence",
                "summary",
                "draft_response",
                "suggested_action",
              ],
            },
          },
        },
      ],
      toolChoice: { type: "function", function: { name: "classify_and_respond" } },
    });

    const classification = extractToolCallArgs(aiData) || {
      intent: "other",
      confidence: 0,
      summary: "Could not classify",
      draft_response: "",
      suggested_action: "manual_review",
    };

    const intent = classification.intent as string;

    // 3. Insert into inbound_replies
    const { data: reply, error: insertError } = await sb
      .from("inbound_replies")
      .insert({
        outreach_message_id: outreachMessageId,
        lead_id: leadId,
        company_id: companyId,
        from_identifier,
        subject,
        body: replyBody,
        channel,
        intent,
        confidence: classification.confidence,
        summary: classification.summary,
        draft_response: classification.draft_response,
        suggested_action: classification.suggested_action,
        status: "new",
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // 4. Update lead status based on intent
    const leadStatusMap: Record<string, string> = {
      interested: "replied",
      meeting_request: "call_scheduled",
      call_request: "call_scheduled",
      not_interested: "rejected",
      referral: "replied",
      question: "replied",
    };

    const newLeadStatus = leadStatusMap[intent];
    if (newLeadStatus && leadId) {
      await sb.from("leads").update({ status: newLeadStatus }).eq("id", leadId);
    }

    // 5. Increment campaign replies_received
    if (campaignId) {
      const { data: campaign } = await sb
        .from("campaigns")
        .select("replies_received")
        .eq("id", campaignId)
        .maybeSingle();

      if (campaign) {
        await sb
          .from("campaigns")
          .update({ replies_received: (campaign.replies_received || 0) + 1 })
          .eq("id", campaignId);
      }
    }

    // 6. Log activity
    await logActivity(
      sb,
      "reply_received",
      companyId,
      `Reply from ${leadName} classified as "${intent}"`,
      {
        reply_id: reply.id,
        lead_id: leadId,
        outreach_message_id: outreachMessageId,
        intent,
        confidence: classification.confidence,
        channel,
      }
    );

    return jsonResponse({
      success: true,
      reply_id: reply.id,
      intent,
      confidence: classification.confidence,
      summary: classification.summary,
      draft_response: classification.draft_response,
      suggested_action: classification.suggested_action,
    });
  } catch (e) {
    console.error("handle-reply error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
