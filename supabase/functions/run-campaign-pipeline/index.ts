// Campaign pipeline orchestrator
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
// Calls sibling edge functions via HTTP using service_role key
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

    if (!res.ok) {
      return { data: null, error: data?.error || `${name} returned ${res.status}` };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : `${name} call failed` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS HELPER — writes updates to pipeline_runs table
// ─────────────────────────────────────────────────────────────────────────────

type PipelineStage =
  | "discovering"
  | "saving_leads"
  | "researching"
  | "scoring"
  | "decision_makers"
  | "generating_outreach"
  | "completed"
  | "failed";

interface ProgressUpdate {
  current_stage: PipelineStage;
  progress_message: string;
  leads_discovered?: number;
  leads_qualified?: number;
  messages_generated?: number;
  status?: "running" | "completed" | "failed";
  error_message?: string;
  completed_at?: string;
}

async function updateProgress(
  sb: ReturnType<typeof getSupabaseClient>,
  runId: string,
  update: ProgressUpdate
) {
  await sb.from("pipeline_runs").update(update).eq("id", runId);
}

/** Wait ms milliseconds */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─────────────────────────────────────────────────────────────────────────────
// PROVENANCE HELPERS — best-effort, never break the pipeline
// ─────────────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

async function logStep(
  sb: ReturnType<typeof getSupabaseClient>,
  runId: string,
  leadId: string,
  stepName: string,
  providerName: string | null,
  status: StepStatus,
  extra?: { input_summary?: string; output_summary?: string; error_message?: string; duration_ms?: number }
): Promise<string | null> {
  try {
    const row: Record<string, unknown> = {
      pipeline_run_id: runId,
      lead_id: leadId,
      step_name: stepName,
      provider_name: providerName,
      status,
      ...extra,
    };
    if (status === "completed" || status === "failed" || status === "skipped") {
      row.completed_at = new Date().toISOString();
    }
    const { data } = await sb.from("lead_run_steps").insert(row).select("id").maybeSingle();
    return data?.id ?? null;
  } catch (err) {
    console.warn(`[provenance] logStep failed (${stepName}/${leadId}):`, err);
    return null;
  }
}

async function updateStep(
  sb: ReturnType<typeof getSupabaseClient>,
  stepId: string | null,
  status: StepStatus,
  extra?: { output_summary?: string; error_message?: string; duration_ms?: number }
) {
  if (!stepId) return;
  try {
    const row: Record<string, unknown> = { status, ...extra };
    if (status === "completed" || status === "failed" || status === "skipped") {
      row.completed_at = new Date().toISOString();
    }
    await sb.from("lead_run_steps").update(row).eq("id", stepId);
  } catch (err) {
    console.warn(`[provenance] updateStep failed (${stepId}):`, err);
  }
}

async function logProvenance(
  sb: ReturnType<typeof getSupabaseClient>,
  leadId: string,
  fields: Array<{ field_name: string; field_value: string | null; source_provider: string; source_url?: string | null; confidence?: number }>
) {
  try {
    const rows = fields
      .filter((f) => f.field_value)
      .map((f) => ({
        lead_id: leadId,
        field_name: f.field_name,
        field_value: f.field_value!,
        source_provider: f.source_provider,
        source_url: f.source_url ?? null,
        confidence: f.confidence ?? 0.5,
      }));
    if (rows.length > 0) {
      await sb.from("lead_field_provenance").insert(rows);
    }
  } catch (err) {
    console.warn(`[provenance] logProvenance failed (${leadId}):`, err);
  }
}

async function logScrapedPages(
  sb: ReturnType<typeof getSupabaseClient>,
  leadId: string,
  runId: string,
  pages: Array<{ url: string; content: string; provider: string; quality?: string }>
) {
  try {
    const rows = pages
      .filter((p) => p.url && p.content)
      .map((p) => ({
        lead_id: leadId,
        pipeline_run_id: runId,
        url: p.url,
        provider_name: p.provider,
        raw_content: p.content.slice(0, 50_000), // cap at 50KB per page
        extraction_quality: p.quality ?? "medium",
      }));
    if (rows.length > 0) {
      await sb.from("scraped_pages").insert(rows);
    }
  } catch (err) {
    console.warn(`[provenance] logScrapedPages failed (${leadId}):`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const sb = getSupabaseClient();

    const isKilled = await checkDeadSwitch(sb);
    if (isKilled) return errorResponse("AI operations are currently disabled by admin.", 503);

    const body = await req.json();
    const { campaignId, companyId, targetCriteria, geographicFocus, minimumScore, tone } = body;

    if (!campaignId || !companyId || !targetCriteria || !geographicFocus) {
      return errorResponse("Missing required params: campaignId, companyId, targetCriteria, geographicFocus", 400);
    }

    // ── Create pipeline_runs record ──
    const { data: run, error: runErr } = await sb
      .from("pipeline_runs")
      .insert({
        campaign_id: campaignId,
        company_id: companyId,
        status: "running",
        current_stage: "discovering",
        progress_message: "Starting pipeline...",
      })
      .select("id")
      .single();

    if (runErr || !run) {
      return errorResponse(`Failed to create pipeline run: ${runErr?.message || "unknown"}`, 500);
    }

    const runId = run.id;

    // Return the run ID immediately — client will poll pipeline_runs for updates
    // The pipeline execution continues below via respondWith pattern
    const responsePromise = (async () => {
      try {
        await executePipeline(sb, runId, {
          campaignId,
          companyId,
          targetCriteria,
          geographicFocus,
          minimumScore: minimumScore ?? 3.0,
          tone: tone ?? "professional",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Pipeline failed";
        console.error("[run-campaign-pipeline] Fatal error:", err);
        await updateProgress(sb, runId, {
          current_stage: "failed",
          progress_message: message,
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        });
        await sb.from("campaigns").update({ status: "setup" }).eq("id", campaignId);
      }
    })();

    // Wait for completion — the edge function stays alive until done
    await responsePromise;

    // Re-read final state to return
    const { data: finalRun } = await sb
      .from("pipeline_runs")
      .select("*")
      .eq("id", runId)
      .single();

    return jsonResponse({ run_id: runId, ...finalRun });
  } catch (e) {
    console.error("run-campaign-pipeline error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

interface PipelineParams {
  campaignId: string;
  companyId: string;
  targetCriteria: Record<string, unknown>;
  geographicFocus: string;
  minimumScore: number;
  tone: string;
}

async function executePipeline(
  sb: ReturnType<typeof getSupabaseClient>,
  runId: string,
  params: PipelineParams
) {
  const { campaignId, companyId, targetCriteria, geographicFocus, minimumScore, tone } = params;

  // ── Fetch company profile ──
  const { data: companyData } = await sb
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  const companyProfile = companyData
    ? {
        name: companyData.name,
        industry: companyData.industry,
        description: companyData.description || "",
        website: companyData.website || "",
        services: companyData.services || [],
        selling_points: companyData.selling_points || [],
        target_markets: companyData.target_markets || [],
        tone_preference: companyData.tone_preference || tone,
        pricing_summary: companyData.pricing_summary || "",
        geographic_range: companyData.geographic_range || geographicFocus,
      }
    : {
        name: "Company",
        industry: "",
        description: "",
        website: "",
        services: [],
        selling_points: [],
        target_markets: [],
        tone_preference: tone,
        pricing_summary: "",
        geographic_range: geographicFocus,
      };

  // ══════════════════════════════════════════
  // STAGE 1: DISCOVER
  // ══════════════════════════════════════════
  await updateProgress(sb, runId, {
    current_stage: "discovering",
    progress_message: "Searching for real businesses...",
  });
  await sb.from("campaigns").update({ status: "hunting" }).eq("id", campaignId);

  const { data: discoverData, error: discoverError } = await callEdgeFunction("discover-leads", {
    campaignId,
    companyProfile,
    targetCriteria,
    geographicFocus,
  });

  if (discoverError) {
    throw new Error(discoverError || "Lead discovery failed. Check your Serper API key.");
  }

  const discoveredLeads = (discoverData?.leads as Record<string, unknown>[]) || [];
  if (discoveredLeads.length === 0) {
    throw new Error(
      (discoverData?.error as string) ||
        "No businesses found. Try broader criteria."
    );
  }

  await updateProgress(sb, runId, {
    current_stage: "saving_leads",
    progress_message: `Found ${discoveredLeads.length} businesses. Saving...`,
    leads_discovered: discoveredLeads.length,
  });

  // ══════════════════════════════════════════
  // STAGE 2: SAVE LEADS
  // ══════════════════════════════════════════
  const leadsToInsert = discoveredLeads.map((lead) => ({
    business_name: lead.business_name || "Unknown Business",
    website: lead.website || null,
    email: lead.email || null,
    phone: lead.phone || null,
    address: lead.address || null,
    city: lead.city || geographicFocus,
    region: lead.region || null,
    country: lead.country || null,
    industry: lead.industry || "Business Services",
    description: lead.description || null,
    rating: lead.rating || null,
    review_count: lead.review_count || null,
    size_estimate: lead.size_estimate || "small",
    contact_name: lead.contact_name || null,
    contact_role: lead.contact_role || null,
    contact_email: (lead.email as string) || null,
    campaign_id: campaignId,
    company_id: companyId,
    status: "discovered",
    source: "google_maps",
  }));

  const { data: insertedLeads, error: insertErr } = await sb
    .from("leads")
    .insert(leadsToInsert)
    .select("id, business_name, website, city, industry, description, size_estimate, contact_email");

  if (insertErr) throw new Error(`Database error saving leads: ${insertErr.message}`);

  const savedLeads = insertedLeads || [];
  const totalLeads = savedLeads.length;

  // ── Log discover step + field provenance for each saved lead ──
  for (let i = 0; i < savedLeads.length; i++) {
    const saved = savedLeads[i];
    const original = discoveredLeads[i] || {};
    const source = (original.source as string) || "serper";

    await logStep(sb, runId, saved.id, "discover", source, "completed", {
      output_summary: `Discovered: ${saved.business_name}`,
    });

    await logProvenance(sb, saved.id, [
      { field_name: "website", field_value: saved.website, source_provider: source, confidence: 0.8 },
      { field_name: "phone", field_value: original.phone as string, source_provider: source, confidence: 0.7 },
      { field_name: "contact_email", field_value: saved.contact_email, source_provider: source, confidence: 0.5 },
      { field_name: "description", field_value: saved.description, source_provider: source, confidence: 0.6 },
    ]);
  }

  await updateProgress(sb, runId, {
    current_stage: "researching",
    progress_message: `Saved ${totalLeads} leads. Researching...`,
    leads_discovered: totalLeads,
  });

  // ══════════════════════════════════════════
  // STAGE 3: RESEARCH (via research-lead edge function)
  // ══════════════════════════════════════════
  let researchedCount = 0;
  for (const lead of savedLeads) {
    const t0 = Date.now();
    const stepId = await logStep(sb, runId, lead.id, "research", "serper", "running", {
      input_summary: `Research ${lead.business_name} (${lead.website || "no website"})`,
    });

    const { data: researchResult, error: researchErr } = await callEdgeFunction("research-lead", {
      lead_id: lead.id,
    });

    const durationMs = Date.now() - t0;

    if (researchErr) {
      console.error(`[pipeline] research-lead failed for ${lead.business_name}:`, researchErr);
      await updateStep(sb, stepId, "failed", { error_message: researchErr, duration_ms: durationMs });
    } else {
      await updateStep(sb, stepId, "completed", {
        output_summary: researchResult?.status === "skipped" ? "Serper disabled" : "Research complete",
        duration_ms: durationMs,
      });

      // Log scraped pages if research-lead returned page content
      const pages = (researchResult?.pages_fetched as Array<{ url: string; content: string; provider?: string }>) || [];
      if (pages.length > 0) {
        await logScrapedPages(sb, lead.id, runId, pages.map((p) => ({
          url: p.url,
          content: p.content,
          provider: p.provider || "serper",
        })));
      }

      // Log provenance for any enriched fields
      const enriched = researchResult?.enriched_fields as Record<string, string> | undefined;
      if (enriched) {
        await logProvenance(sb, lead.id, [
          { field_name: "contact_name", field_value: enriched.contact_name, source_provider: "serper", confidence: 0.6 },
          { field_name: "contact_email", field_value: enriched.contact_email, source_provider: "serper", confidence: 0.6 },
          { field_name: "phone", field_value: enriched.phone, source_provider: "serper", confidence: 0.7 },
          { field_name: "website", field_value: enriched.website, source_provider: "serper", confidence: 0.9 },
        ]);
      }
    }

    researchedCount++;
    if (researchedCount % 3 === 0 || researchedCount === totalLeads) {
      await updateProgress(sb, runId, {
        current_stage: "researching",
        progress_message: `Researching (${researchedCount}/${totalLeads}): ${lead.business_name}...`,
        leads_discovered: totalLeads,
      });
    }
    await sleep(300);
  }

  // ══════════════════════════════════════════
  // STAGE 4: SCORE (via score-lead edge function)
  // ══════════════════════════════════════════
  await updateProgress(sb, runId, {
    current_stage: "scoring",
    progress_message: "Scoring lead fit...",
    leads_discovered: totalLeads,
  });
  await sb.from("campaigns").update({ status: "scoring" }).eq("id", campaignId);

  // Re-fetch leads with research data
  const { data: researchedLeads } = await sb
    .from("leads")
    .select("id, business_name, website, city, industry, description, size_estimate, contact_email, research_data")
    .eq("campaign_id", campaignId)
    .eq("company_id", companyId);

  const leadsToScore = researchedLeads || savedLeads;
  let qualifiedCount = 0;

  for (let i = 0; i < leadsToScore.length; i++) {
    const lead = leadsToScore[i];
    const researchData = (lead.research_data as Record<string, unknown>) || {};
    const leadForScoring = {
      business_name: lead.business_name,
      website: lead.website,
      city: lead.city,
      industry: lead.industry,
      description: lead.description,
      size_estimate: lead.size_estimate,
      web_snippets: researchData.services_offered || [],
      services_found: researchData.competitive_advantages || [],
    };

    const t0 = Date.now();
    const stepId = await logStep(sb, runId, lead.id, "score", "gemini", "running", {
      input_summary: `Score ${lead.business_name}`,
    });

    const { data: scoreData, error: scoreErr } = await callEdgeFunction("score-lead", {
      lead: leadForScoring,
      companyProfile,
    });

    const durationMs = Date.now() - t0;
    const score: number = scoreErr ? 3.0 : ((scoreData?.score as number) ?? 3.0);
    const reasoning: string = scoreErr
      ? "Scoring service unavailable"
      : ((scoreData?.reasoning as string) ?? "");
    const qualified = score >= minimumScore;
    if (qualified) qualifiedCount++;

    await updateStep(sb, stepId, scoreErr ? "failed" : "completed", {
      output_summary: `Score: ${score}/5 — ${qualified ? "qualified" : "not qualified"}`,
      error_message: scoreErr || undefined,
      duration_ms: durationMs,
    });

    await sb
      .from("leads")
      .update({
        score,
        score_reasoning: reasoning,
        status: qualified ? "qualified" : "scored",
      })
      .eq("id", lead.id);

    if ((i + 1) % 3 === 0 || i === leadsToScore.length - 1) {
      await updateProgress(sb, runId, {
        current_stage: "scoring",
        progress_message: `Scoring (${i + 1}/${leadsToScore.length}): ${lead.business_name}...`,
        leads_discovered: totalLeads,
        leads_qualified: qualifiedCount,
      });
    }
    await sleep(200);
  }

  await updateProgress(sb, runId, {
    current_stage: "scoring",
    progress_message: `Scored all leads — ${qualifiedCount}/${totalLeads} qualified.`,
    leads_discovered: totalLeads,
    leads_qualified: qualifiedCount,
  });

  await sb.from("campaigns").update({
    leads_found: totalLeads,
    leads_qualified: qualifiedCount,
    status: "outreach",
  }).eq("id", campaignId);

  // Sync Hub telemetry (best effort)
  if (qualifiedCount > 0) {
    try {
      await logActivity(sb, "new_lead", companyId, `${qualifiedCount} new leads — Google Places`, {
        source: "google_maps",
        campaign_id: campaignId,
      });
    } catch { /* non-critical */ }
  }

  // ══════════════════════════════════════════
  // STAGE 5: DECISION MAKERS (qualified leads only)
  // ══════════════════════════════════════════
  const { data: qualifiedLeads } = await sb
    .from("leads")
    .select("id, business_name, city, website, contact_email")
    .eq("campaign_id", campaignId)
    .eq("status", "qualified");

  const qualifiedList = qualifiedLeads || [];

  if (qualifiedList.length > 0) {
    await updateProgress(sb, runId, {
      current_stage: "decision_makers",
      progress_message: `Finding decision makers for ${qualifiedList.length} qualified leads...`,
      leads_discovered: totalLeads,
      leads_qualified: qualifiedCount,
    });

    let dmCount = 0;
    for (let i = 0; i < qualifiedList.length; i++) {
      const lead = qualifiedList[i];
      const t0 = Date.now();
      const stepId = await logStep(sb, runId, lead.id, "decision_makers", "serper", "running", {
        input_summary: `Find decision makers for ${lead.business_name}`,
      });

      const { error: edgeErr } = await callEdgeFunction("research-lead", {
        lead_id: lead.id,
      });

      const durationMs = Date.now() - t0;

      if (edgeErr) {
        console.error(`[pipeline] research-lead (DM) failed for ${lead.business_name}:`, edgeErr);
        await updateStep(sb, stepId, "failed", { error_message: edgeErr, duration_ms: durationMs });
      } else {
        dmCount++;
        await updateStep(sb, stepId, "completed", {
          output_summary: "Decision maker research complete",
          duration_ms: durationMs,
        });
      }

      if ((i + 1) % 2 === 0 || i === qualifiedList.length - 1) {
        await updateProgress(sb, runId, {
          current_stage: "decision_makers",
          progress_message: `Decision makers (${i + 1}/${qualifiedList.length}): ${lead.business_name}...`,
          leads_discovered: totalLeads,
          leads_qualified: qualifiedCount,
        });
      }
      await sleep(400);
    }

    console.log(`[pipeline] Decision makers found for ${dmCount}/${qualifiedList.length} leads`);
  }

  // ══════════════════════════════════════════
  // STAGE 6: GENERATE OUTREACH
  // ══════════════════════════════════════════
  let messagesGenerated = 0;

  if (qualifiedList.length > 0) {
    await updateProgress(sb, runId, {
      current_stage: "generating_outreach",
      progress_message: `Writing outreach for ${qualifiedList.length} leads...`,
      leads_discovered: totalLeads,
      leads_qualified: qualifiedCount,
    });

    // Re-fetch qualified leads with enriched data for outreach
    const { data: enrichedLeads } = await sb
      .from("leads")
      .select("id, business_name, city, region, industry, website, description, contact_name, contact_role, contact_email, rating, review_count, research_data")
      .eq("campaign_id", campaignId)
      .eq("status", "qualified");

    const outreachLeads = enrichedLeads || qualifiedList;

    for (let i = 0; i < outreachLeads.length; i++) {
      const lead = outreachLeads[i];
      const researchData = (lead.research_data as Record<string, unknown>) || {};

      const t0 = Date.now();
      const stepId = await logStep(sb, runId, lead.id, "outreach", "gemini", "running", {
        input_summary: `Generate outreach for ${lead.business_name}`,
      });

      const { data: emailData, error: emailErr } = await callEdgeFunction("generate-outreach", {
        lead: {
          ...lead,
          web_snippets: researchData.services_offered || [],
          services_found: researchData.competitive_advantages || [],
        },
        companyProfile,
        tone,
      });

      const durationMs = Date.now() - t0;

      if (emailErr || !emailData?.subject) {
        console.warn(`[pipeline] Outreach failed for ${lead.business_name}:`, emailErr);
        await updateStep(sb, stepId, "failed", {
          error_message: emailErr || "No subject returned",
          duration_ms: durationMs,
        });
      } else {
        const { error: msgErr } = await sb.from("outreach_emails").insert({
          campaign_id: campaignId,
          company_id: companyId,
          lead_id: lead.id,
          subject: emailData.subject as string,
          body: emailData.body as string,
          email_type: "outreach",
          status: "draft",
          ai_model_used: "gemini-flash",
        });

        if (!msgErr) messagesGenerated++;

        await updateStep(sb, stepId, msgErr ? "failed" : "completed", {
          output_summary: msgErr ? `DB insert failed: ${msgErr.message}` : `Subject: ${(emailData.subject as string).slice(0, 80)}`,
          error_message: msgErr?.message,
          duration_ms: durationMs,
        });
      }

      if ((i + 1) % 2 === 0 || i === outreachLeads.length - 1) {
        await updateProgress(sb, runId, {
          current_stage: "generating_outreach",
          progress_message: `Outreach (${i + 1}/${outreachLeads.length}): ${lead.business_name}...`,
          leads_discovered: totalLeads,
          leads_qualified: qualifiedCount,
          messages_generated: messagesGenerated,
        });
      }
      await sleep(200);
    }

    await sb.from("campaigns").update({ emails_sent: messagesGenerated }).eq("id", campaignId);
  }

  // ══════════════════════════════════════════
  // FINALIZE
  // ══════════════════════════════════════════
  await sb.from("campaigns").update({ status: "active" }).eq("id", campaignId);

  await updateProgress(sb, runId, {
    current_stage: "completed",
    progress_message: `Complete! ${totalLeads} discovered, ${qualifiedCount} qualified, ${messagesGenerated} outreach drafted.`,
    status: "completed",
    leads_discovered: totalLeads,
    leads_qualified: qualifiedCount,
    messages_generated: messagesGenerated,
    completed_at: new Date().toISOString(),
  });

  await logActivity(
    sb,
    "pipeline_completed",
    companyId,
    `Campaign pipeline completed: ${totalLeads} leads, ${qualifiedCount} qualified, ${messagesGenerated} outreach`,
    { campaign_id: campaignId, run_id: runId }
  );

  console.log(`[pipeline] Complete: ${totalLeads} discovered, ${qualifiedCount} qualified, ${messagesGenerated} outreach`);
}
