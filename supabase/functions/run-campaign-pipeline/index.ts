import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getSupabaseClient,
  checkDeadSwitch,
  optionsResponse,
  jsonResponse,
  errorResponse,
  logActivity,
} from "../_shared/utils.ts";

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL EDGE FUNCTION CALLER
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callEdgeFunction(
  name: string,
  body: Record<string, unknown>
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { data: null, error: data?.error || `${name} returned ${res.status}` };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : `${name} call failed` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS + PROVENANCE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

type SB = ReturnType<typeof getSupabaseClient>;

interface ProgressUpdate {
  current_stage: string;
  progress_message: string;
  leads_discovered?: number;
  leads_qualified?: number;
  messages_generated?: number;
  status?: "running" | "completed" | "failed";
  error_message?: string;
  completed_at?: string;
}

async function updateProgress(sb: SB, runId: string, update: ProgressUpdate) {
  await sb.from("pipeline_runs").update(update).eq("id", runId);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function logStep(
  sb: SB, runId: string, leadId: string, stepName: string,
  providerName: string | null, status: string,
  extra?: { input_summary?: string; output_summary?: string; error_message?: string; duration_ms?: number }
): Promise<string | null> {
  try {
    const row: Record<string, unknown> = {
      pipeline_run_id: runId, lead_id: leadId, step_name: stepName,
      provider_name: providerName, status, ...extra,
    };
    if (status === "completed" || status === "failed" || status === "skipped") row.completed_at = new Date().toISOString();
    const { data } = await sb.from("lead_run_steps").insert(row).select("id").maybeSingle();
    return data?.id ?? null;
  } catch { return null; }
}

async function updateStep(sb: SB, stepId: string | null, status: string, extra?: Record<string, unknown>) {
  if (!stepId) return;
  try {
    const row: Record<string, unknown> = { status, ...extra };
    if (status === "completed" || status === "failed") row.completed_at = new Date().toISOString();
    await sb.from("lead_run_steps").update(row).eq("id", stepId);
  } catch { /* best-effort */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const sb = getSupabaseClient();
    if (await checkDeadSwitch(sb)) return errorResponse("AI operations are currently disabled by admin.", 503);

    const body = await req.json();
    const { campaignId, companyId, targetCriteria, geographicFocus, minimumScore, tone } = body;
    if (!campaignId || !companyId || !targetCriteria || !geographicFocus) {
      return errorResponse("Missing required params: campaignId, companyId, targetCriteria, geographicFocus", 400);
    }

    // Create pipeline_runs record
    const { data: run, error: runErr } = await sb
      .from("pipeline_runs")
      .insert({ campaign_id: campaignId, company_id: companyId, status: "running", current_stage: "discovering", progress_message: "Starting pipeline..." })
      .select("id")
      .single();

    if (runErr || !run) return errorResponse(`Failed to create pipeline run: ${runErr?.message || "unknown"}`, 500);
    const runId = run.id;

    // Return run_id immediately, then execute pipeline
    const exec = (async () => {
      try {
        await executePipeline(sb, runId, { campaignId, companyId, targetCriteria, geographicFocus, minimumScore: minimumScore ?? 3.0, tone: tone ?? "professional" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Pipeline failed";
        console.error("[pipeline] Fatal:", err);
        await updateProgress(sb, runId, { current_stage: "failed", progress_message: message, status: "failed", error_message: message, completed_at: new Date().toISOString() });
        await sb.from("campaigns").update({ status: "setup" }).eq("id", campaignId);
      }
    })();

    await exec;
    const { data: finalRun } = await sb.from("pipeline_runs").select("*").eq("id", runId).single();
    return jsonResponse({ run_id: runId, ...finalRun });
  } catch (e) {
    console.error("run-campaign-pipeline error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10-STAGE PIPELINE EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

interface PipelineParams {
  campaignId: string;
  companyId: string;
  targetCriteria: Record<string, unknown>;
  geographicFocus: string;
  minimumScore: number;
  tone: string;
}

async function executePipeline(sb: SB, runId: string, params: PipelineParams) {
  const { campaignId, companyId, targetCriteria, geographicFocus, minimumScore, tone } = params;

  // Fetch company profile
  const { data: companyData } = await sb.from("companies").select("*").eq("id", companyId).single();
  const companyProfile = companyData
    ? { name: companyData.name, industry: companyData.industry, services: companyData.services || [], target_markets: companyData.target_markets || [], unique_selling_points: companyData.selling_points || [], tone_preference: companyData.tone_preference || tone }
    : { name: "Company", services: [], target_markets: [], unique_selling_points: [], tone_preference: tone };

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 1: DISCOVERY
  // ══════════════════════════════════════════════════════════════════════════
  await updateProgress(sb, runId, { current_stage: "discovering", progress_message: `🔍 Discovering businesses in ${geographicFocus}...` });
  await sb.from("campaigns").update({ status: "hunting" }).eq("id", campaignId);

  const { data: discoverData, error: discoverError } = await callEdgeFunction("discover-leads", {
    campaignId, companyProfile, targetCriteria, geographicFocus,
  });

  if (discoverError) throw new Error(discoverError || "Lead discovery failed. Check your Serper API key.");

  const discoveredLeads = (discoverData?.leads as Record<string, unknown>[]) || [];
  if (discoveredLeads.length === 0) throw new Error((discoverData?.error as string) || "No businesses found. Try broader criteria.");

  // Save leads
  const leadsToInsert = discoveredLeads.map((lead) => ({
    business_name: lead.business_name || "Unknown Business",
    website: lead.website || null, email: lead.email || null, phone: lead.phone || null,
    address: lead.address || null, city: lead.city || geographicFocus,
    region: lead.region || null, country: lead.country || null,
    industry: lead.industry || "Business Services", description: lead.description || null,
    rating: lead.rating || null, review_count: lead.review_count || null,
    size_estimate: lead.size_estimate || "small",
    contact_name: lead.contact_name || null, contact_role: lead.contact_role || null,
    contact_email: (lead.email as string) || null,
    campaign_id: campaignId, company_id: companyId, status: "discovered", source: "google_maps",
  }));

  const { data: insertedLeads, error: insertErr } = await sb.from("leads").insert(leadsToInsert)
    .select("id, business_name, website, city, industry, description, size_estimate, contact_email");
  if (insertErr) throw new Error(`Database error saving leads: ${insertErr.message}`);

  const savedLeads = insertedLeads || [];
  const totalLeads = savedLeads.length;

  await updateProgress(sb, runId, {
    current_stage: "discovering",
    progress_message: `🔍 Found ${totalLeads} businesses in ${geographicFocus}`,
    leads_discovered: totalLeads,
  });

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 2: WEBSITE RESEARCH
  // ══════════════════════════════════════════════════════════════════════════
  await updateProgress(sb, runId, { current_stage: "researching", progress_message: `🌐 Researching ${totalLeads} businesses...`, leads_discovered: totalLeads });

  for (let i = 0; i < savedLeads.length; i++) {
    const lead = savedLeads[i];
    const t0 = Date.now();
    const stepId = await logStep(sb, runId, lead.id, "research", "serper", "running");

    const { error: researchErr } = await callEdgeFunction("research-lead", { lead_id: lead.id });
    await updateStep(sb, stepId, researchErr ? "failed" : "completed", { duration_ms: Date.now() - t0, error_message: researchErr || undefined });

    // Update lead status
    if (!researchErr) await sb.from("leads").update({ status: "researched" }).eq("id", lead.id);

    if ((i + 1) % 3 === 0 || i === savedLeads.length - 1) {
      await updateProgress(sb, runId, {
        current_stage: "researching",
        progress_message: `🌐 Researching ${lead.business_name}... (${i + 1}/${totalLeads})`,
        leads_discovered: totalLeads,
      });
    }
    await sleep(300);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 3: AI SCORING
  // ══════════════════════════════════════════════════════════════════════════
  await updateProgress(sb, runId, { current_stage: "scoring", progress_message: "⭐ Scoring lead fit...", leads_discovered: totalLeads });
  await sb.from("campaigns").update({ status: "scoring" }).eq("id", campaignId);

  const { data: researchedLeads } = await sb.from("leads")
    .select("id, business_name, website, city, industry, description, size_estimate, contact_email, research_data")
    .eq("campaign_id", campaignId).eq("company_id", companyId);

  const leadsToScore = researchedLeads || savedLeads;
  let qualifiedCount = 0;

  for (let i = 0; i < leadsToScore.length; i++) {
    const lead = leadsToScore[i];
    const researchData = (lead.research_data as Record<string, unknown>) || {};
    const t0 = Date.now();
    const stepId = await logStep(sb, runId, lead.id, "score", "gemini", "running");

    const { data: scoreData, error: scoreErr } = await callEdgeFunction("score-lead", {
      lead: { business_name: lead.business_name, website: lead.website, city: lead.city, industry: lead.industry, description: lead.description, size_estimate: lead.size_estimate, web_snippets: researchData.services_offered || [], services_found: researchData.competitive_advantages || [] },
      companyProfile,
    });

    const score: number = scoreErr ? 3.0 : ((scoreData?.score as number) ?? 3.0);
    const reasoning = scoreErr ? "Scoring service unavailable" : ((scoreData?.reasoning as string) ?? "");
    const qualified = score >= minimumScore;
    if (qualified) qualifiedCount++;

    await updateStep(sb, stepId, scoreErr ? "failed" : "completed", { output_summary: `Score: ${score}/5`, duration_ms: Date.now() - t0 });
    await sb.from("leads").update({ score, score_reasoning: reasoning, status: qualified ? "qualified" : "scored" }).eq("id", lead.id);

    if ((i + 1) % 3 === 0 || i === leadsToScore.length - 1) {
      await updateProgress(sb, runId, { current_stage: "scoring", progress_message: `⭐ Scoring ${lead.business_name}... (${i + 1}/${leadsToScore.length})`, leads_discovered: totalLeads, leads_qualified: qualifiedCount });
    }
    await sleep(200);
  }

  await sb.from("campaigns").update({ leads_found: totalLeads, leads_qualified: qualifiedCount, status: "outreach" }).eq("id", campaignId);

  // Get qualified leads for remaining stages
  const { data: qualifiedLeads } = await sb.from("leads")
    .select("id, business_name, city, region, country, website, industry, description, contact_name, contact_role, contact_email, contact_phone, contact_source, contact_linkedin_url, rating, review_count, research_data, email_verification_status, score, score_reasoning")
    .eq("campaign_id", campaignId).eq("status", "qualified");

  const qualifiedList = qualifiedLeads || [];

  if (qualifiedList.length === 0) {
    await updateProgress(sb, runId, { current_stage: "completed", progress_message: `🎯 Complete! ${totalLeads} discovered, 0 qualified (none met your minimum score of ${minimumScore})`, status: "completed", leads_discovered: totalLeads, leads_qualified: 0, messages_generated: 0, completed_at: new Date().toISOString() });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 4: DECISION MAKER HUNT
  // ══════════════════════════════════════════════════════════════════════════
  await updateProgress(sb, runId, { current_stage: "decision_makers", progress_message: `🕵️ Hunting decision makers for ${qualifiedList.length} leads...`, leads_discovered: totalLeads, leads_qualified: qualifiedCount });

  for (let i = 0; i < qualifiedList.length; i++) {
    const lead = qualifiedList[i];
    if (lead.contact_source === "apollo" && lead.contact_email) continue;

    const stepId = await logStep(sb, runId, lead.id, "decision_makers", "serper", "running");
    const t0 = Date.now();

    await updateProgress(sb, runId, { current_stage: "decision_makers", progress_message: `🕵️ Hunting decision maker for ${lead.business_name}... (${i + 1}/${qualifiedList.length})`, leads_discovered: totalLeads, leads_qualified: qualifiedCount });

    const { data: dmData, error: dmErr } = await callEdgeFunction("find-decision-maker", { lead_id: lead.id, pipeline_run_id: runId });
    await updateStep(sb, stepId, dmErr ? "failed" : "completed", { duration_ms: Date.now() - t0, error_message: dmErr || undefined });
    await sleep(300);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 5: DEEP ENRICHMENT
  // ══════════════════════════════════════════════════════════════════════════
  await updateProgress(sb, runId, { current_stage: "enriching", progress_message: `🔬 Enriching ${qualifiedList.length} leads...`, leads_discovered: totalLeads, leads_qualified: qualifiedCount });

  for (let i = 0; i < qualifiedList.length; i++) {
    const lead = qualifiedList[i];
    const stepId = await logStep(sb, runId, lead.id, "enrich", "apollo+serper", "running");
    const t0 = Date.now();

    await updateProgress(sb, runId, { current_stage: "enriching", progress_message: `🔬 Enriching ${lead.business_name}... (${i + 1}/${qualifiedList.length})`, leads_discovered: totalLeads, leads_qualified: qualifiedCount });

    const { error: enrichErr } = await callEdgeFunction("enrich-lead", { lead_id: lead.id });
    await updateStep(sb, stepId, enrichErr ? "failed" : "completed", { duration_ms: Date.now() - t0, error_message: enrichErr || undefined });
    await sleep(300);
  }

  // Re-fetch qualified leads with all enrichment data
  const { data: enrichedLeads } = await sb.from("leads")
    .select("id, business_name, city, region, country, website, industry, description, contact_name, contact_role, contact_email, contact_phone, rating, review_count, research_data, email_verification_status, score, score_reasoning")
    .eq("campaign_id", campaignId).eq("status", "qualified");

  const outreachLeads = enrichedLeads || qualifiedList;
  let messagesGenerated = 0;

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 6: EMAIL GENERATION
  // ══════════════════════════════════════════════════════════════════════════
  await updateProgress(sb, runId, { current_stage: "generating_emails", progress_message: `✉️ Writing emails for ${outreachLeads.length} leads...`, leads_discovered: totalLeads, leads_qualified: qualifiedCount });

  const emailLeads = outreachLeads.filter((l) => (l.contact_email || l.email_verification_status !== "invalid"));

  for (let i = 0; i < emailLeads.length; i++) {
    const lead = emailLeads[i];

    // Skip leads with no email or invalid email
    if (!lead.contact_email) {
      await logStep(sb, runId, lead.id, "email_gen", "gemini", "skipped", { output_summary: "No contact email — flagged for manual review" });
      continue;
    }
    if (lead.email_verification_status === "invalid") {
      await logStep(sb, runId, lead.id, "email_gen", "gemini", "skipped", { output_summary: "Invalid email — flagged for re-enrichment" });
      continue;
    }

    const researchData = (lead.research_data as Record<string, unknown>) || {};
    const stepId = await logStep(sb, runId, lead.id, "email_gen", "gemini", "running");
    const t0 = Date.now();

    await updateProgress(sb, runId, { current_stage: "generating_emails", progress_message: `✉️ Writing email for ${lead.business_name}... (${i + 1}/${emailLeads.length})`, leads_discovered: totalLeads, leads_qualified: qualifiedCount, messages_generated: messagesGenerated });

    const { data: emailData, error: emailErr } = await callEdgeFunction("generate-outreach", {
      lead: { ...lead, web_snippets: researchData.services_offered || [], services_found: researchData.competitive_advantages || [] },
      companyProfile, tone,
    });

    if (emailErr || !emailData?.subject) {
      await updateStep(sb, stepId, "failed", { error_message: emailErr || "No subject returned", duration_ms: Date.now() - t0 });
    } else {
      const { error: msgErr } = await sb.from("outreach_messages").insert({
        campaign_id: campaignId, company_id: companyId, lead_id: lead.id,
        subject: emailData.subject as string, body: emailData.body as string,
        channel: "email", email_type: "outreach", status: "pending_approval",
        ai_model_used: "gemini-flash",
        metadata: { personalisation_used: emailData.personalisation_used || null, sequence_step: "cold_intro" },
      });
      if (!msgErr) messagesGenerated++;
      await updateStep(sb, stepId, msgErr ? "failed" : "completed", { output_summary: `Subject: ${(emailData.subject as string).slice(0, 80)}`, duration_ms: Date.now() - t0 });
    }
    await sleep(200);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 7: LINKEDIN MESSAGE GENERATION
  // ══════════════════════════════════════════════════════════════════════════
  await updateProgress(sb, runId, { current_stage: "generating_linkedin", progress_message: `💼 Writing LinkedIn messages...`, leads_discovered: totalLeads, leads_qualified: qualifiedCount, messages_generated: messagesGenerated });

  const linkedinLeads = outreachLeads.filter((l) => {
    const rd = (l.research_data as Record<string, unknown>) || {};
    return rd.linkedin_url || rd.decision_maker_search;
  });

  for (let i = 0; i < linkedinLeads.length; i++) {
    const lead = linkedinLeads[i];
    const rd = (lead.research_data as Record<string, unknown>) || {};
    const linkedinUrl = rd.linkedin_url as string || null;
    const contactName = lead.contact_name || "there";

    await updateProgress(sb, runId, { current_stage: "generating_linkedin", progress_message: `💼 Writing LinkedIn message for ${lead.business_name}... (${i + 1}/${linkedinLeads.length})`, leads_discovered: totalLeads, leads_qualified: qualifiedCount, messages_generated: messagesGenerated });

    // Generate connection request (max 200 chars) + follow-up
    const connectionMsg = `Hi ${contactName.split(" ")[0]}, I noticed ${lead.business_name} in ${lead.city || "the area"} — I work with ${lead.industry || "businesses"} like yours and would love to connect.`;
    const followUpMsg = `Thanks for connecting! I help ${lead.industry || "businesses"} like ${lead.business_name} with ${Array.isArray(companyProfile.services) ? companyProfile.services[0] || "growth" : "growth"}. Would you be open to a quick chat about how we might help?`;

    const { error: liErr } = await sb.from("outreach_messages").insert({
      campaign_id: campaignId, company_id: companyId, lead_id: lead.id,
      subject: connectionMsg.slice(0, 200),
      body: followUpMsg,
      channel: "linkedin", email_type: "outreach", status: "pending_manual",
      metadata: { linkedin_url: linkedinUrl, sequence_step: "linkedin_connect" },
    });
    if (!liErr) messagesGenerated++;
    await sleep(100);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 8: CALL SCRIPT GENERATION
  // ══════════════════════════════════════════════════════════════════════════
  await updateProgress(sb, runId, { current_stage: "generating_calls", progress_message: `📞 Writing call scripts...`, leads_discovered: totalLeads, leads_qualified: qualifiedCount, messages_generated: messagesGenerated });

  for (let i = 0; i < outreachLeads.length; i++) {
    const lead = outreachLeads[i];
    const stepId = await logStep(sb, runId, lead.id, "call_script", "gemini", "running");
    const t0 = Date.now();

    await updateProgress(sb, runId, { current_stage: "generating_calls", progress_message: `📞 Writing call script for ${lead.business_name}... (${i + 1}/${outreachLeads.length})`, leads_discovered: totalLeads, leads_qualified: qualifiedCount, messages_generated: messagesGenerated });

    const { error: callErr } = await callEdgeFunction("ai-call", {
      lead_id: lead.id, company_id: companyId, campaign_id: campaignId, call_type: "outbound_ai",
    });

    await updateStep(sb, stepId, callErr ? "failed" : "completed", { duration_ms: Date.now() - t0, error_message: callErr || undefined });
    await sleep(200);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 9: QUALITY CHECK
  // ══════════════════════════════════════════════════════════════════════════
  await updateProgress(sb, runId, { current_stage: "quality_check", progress_message: `🔍 Quality checking ${messagesGenerated} emails...`, leads_discovered: totalLeads, leads_qualified: qualifiedCount, messages_generated: messagesGenerated });

  const { data: pendingEmails } = await sb.from("outreach_messages")
    .select("id, subject, body, metadata")
    .eq("campaign_id", campaignId)
    .eq("channel", "email")
    .eq("status", "pending_approval");

  let regenerateCount = 0;

  for (const email of pendingEmails || []) {
    const body = (email.body as string) || "";
    const subject = (email.subject as string) || "";
    const wordCount = body.split(/\s+/).filter(Boolean).length;
    const flags: string[] = [];

    if (wordCount < 80) flags.push("too_short");
    if (wordCount > 200) flags.push("too_long");

    // Check for personalisation — should reference something specific
    const hasPersonalisation = body.includes('"') || body.toLowerCase().includes("noticed") ||
      body.toLowerCase().includes("saw that") || body.toLowerCase().includes("your") ||
      body.toLowerCase().includes("impressed");
    if (!hasPersonalisation) flags.push("not_personalised");

    // Check for CTA
    const hasCTA = body.includes("?") && (
      body.toLowerCase().includes("call") || body.toLowerCase().includes("chat") ||
      body.toLowerCase().includes("meeting") || body.toLowerCase().includes("connect") ||
      body.toLowerCase().includes("discuss") || body.toLowerCase().includes("schedule")
    );
    if (!hasCTA) flags.push("no_cta");

    // Store flags
    const existingMeta = (email.metadata as Record<string, unknown>) || {};
    await sb.from("outreach_messages").update({
      metadata: { ...existingMeta, quality_flags: flags, word_count: wordCount },
    }).eq("id", email.id);

    // Auto-regenerate if 2+ flags (would need to re-call generate-outreach with lead data)
    if (flags.length >= 2) regenerateCount++;
  }

  if (regenerateCount > 0) {
    console.log(`[pipeline] ${regenerateCount} emails flagged for quality issues`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 10: FINALIZE
  // ══════════════════════════════════════════════════════════════════════════
  await updateProgress(sb, runId, { current_stage: "finalizing", progress_message: `🎯 Finalizing campaign...`, leads_discovered: totalLeads, leads_qualified: qualifiedCount, messages_generated: messagesGenerated });

  // Count actual messages
  const { count: emailCount } = await sb.from("outreach_messages").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("channel", "email");
  const { count: linkedinCount } = await sb.from("outreach_messages").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("channel", "linkedin");
  const { count: callCount } = await sb.from("calls").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId);

  const totalMessages = (emailCount || 0) + (linkedinCount || 0);

  await sb.from("campaigns").update({
    status: "active",
    leads_found: totalLeads,
    leads_qualified: qualifiedCount,
    emails_sent: emailCount || 0,
  }).eq("id", campaignId);

  await updateProgress(sb, runId, {
    current_stage: "completed",
    progress_message: `🎯 Complete! ${totalLeads} discovered · ${qualifiedCount} qualified · ${emailCount || 0} emails · ${linkedinCount || 0} LinkedIn · ${callCount || 0} call scripts · Ready for review`,
    status: "completed",
    leads_discovered: totalLeads,
    leads_qualified: qualifiedCount,
    messages_generated: totalMessages,
    completed_at: new Date().toISOString(),
  });

  await logActivity(sb, "pipeline_completed", companyId,
    `Campaign pipeline completed: ${totalLeads} leads, ${qualifiedCount} qualified, ${emailCount || 0} emails, ${linkedinCount || 0} LinkedIn, ${callCount || 0} calls`,
    { campaign_id: campaignId, run_id: runId },
  );

  console.log(`[pipeline] Complete: ${totalLeads} discovered, ${qualifiedCount} qualified, ${totalMessages} messages, ${callCount || 0} calls`);
}
