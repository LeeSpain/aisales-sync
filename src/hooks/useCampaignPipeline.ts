import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { reportEvent, updateDailyMetrics } from "@/lib/syncHub";

export type PipelineStage =
  | "idle"
  | "discovering"
  | "scoring"
  | "saving_leads"
  | "generating_outreach"
  | "finalizing"
  | "done"
  | "error";

interface PipelineState {
  stage: PipelineStage;
  progress: string;
  leadsFound: number;
  leadsQualified: number;
  messagesGenerated: number;
  error: string | null;
}

interface RunPipelineParams {
  campaignId: string;
  companyId: string;
  targetCriteria: Record<string, unknown>;
  geographicFocus: string;
  minimumScore: number;
  tone: string;
}

export function useCampaignPipeline() {
  const [state, setState] = useState<PipelineState>({
    stage: "idle",
    progress: "",
    leadsFound: 0,
    leadsQualified: 0,
    messagesGenerated: 0,
    error: null,
  });

  const runPipeline = useCallback(async (params: RunPipelineParams) => {
    const { campaignId, companyId, targetCriteria, geographicFocus, minimumScore, tone } = params;

    try {
      // ── Step 1: Fetch company profile for AI context ──
      const { data: companyData } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

      const companyProfile = companyData
        ? {
          name: companyData.name,
          industry: companyData.industry,
          services: companyData.services,
          target_markets: companyData.target_markets,
          unique_selling_points: companyData.unique_selling_points,
        }
        : { name: "Company" };

      // ── Step 2: Discover leads ──
      setState((s) => ({ ...s, stage: "discovering", progress: "AI is searching for matching businesses..." }));
      await supabase.from("campaigns").update({ status: "hunting" }).eq("id", campaignId);

      const { data: discoverData, error: discoverErr } = await supabase.functions.invoke("discover-leads", {
        body: { campaignId, companyProfile, targetCriteria, geographicFocus },
      });

      if (discoverErr || !discoverData?.leads?.length) {
        throw new Error(discoverErr?.message || "No leads discovered — try broadening your criteria.");
      }

      const rawLeads = discoverData.leads as Record<string, unknown>[];
      setState((s) => ({ ...s, leadsFound: rawLeads.length, progress: `Found ${rawLeads.length} potential leads. Scoring...` }));

      // ── Step 3: Score leads ──
      setState((s) => ({ ...s, stage: "scoring" }));
      await supabase.from("campaigns").update({ status: "scoring" }).eq("id", campaignId);

      const scoredLeads: Array<Record<string, unknown> & { _score: number; _reasoning: string; _qualified: boolean }> = [];

      for (let i = 0; i < rawLeads.length; i++) {
        setState((s) => ({ ...s, progress: `Scoring lead ${i + 1} of ${rawLeads.length}...` }));

        const { data: scoreData, error: scoreErr } = await supabase.functions.invoke("score-lead", {
          body: { lead: rawLeads[i], companyProfile },
        });

        const score = scoreErr ? 3.0 : (scoreData?.score ?? 3.0);
        const reasoning = scoreErr ? "Scoring unavailable" : (scoreData?.reasoning ?? "");
        const qualified = score >= minimumScore;

        scoredLeads.push({
          ...rawLeads[i],
          _score: score,
          _reasoning: reasoning,
          _qualified: qualified,
        });
      }

      const qualifiedLeads = scoredLeads.filter((l) => l._qualified);
      setState((s) => ({
        ...s,
        leadsQualified: qualifiedLeads.length,
        progress: `${qualifiedLeads.length} of ${rawLeads.length} leads qualified. Saving...`,
      }));

      // ── Step 4: Save leads to DB ──
      setState((s) => ({ ...s, stage: "saving_leads" }));

      const leadsToInsert = scoredLeads.map((l) => ({
        campaign_id: campaignId,
        company_id: companyId,
        business_name: (l.business_name as string) || "Unknown Business",
        website: (l.website as string) || null,
        email: (l.email as string) || null,
        phone: (l.phone as string) || null,
        address: (l.address as string) || null,
        city: (l.city as string) || null,
        region: (l.region as string) || null,
        country: (l.country as string) || null,
        industry: (l.industry as string) || null,
        description: (l.description as string) || null,
        rating: (l.rating as number) || null,
        review_count: (l.review_count as number) || null,
        size_estimate: (l.size_estimate as string) || null,
        contact_name: (l.contact_name as string) || null,
        contact_role: (l.contact_role as string) || null,
        contact_email: (l.contact_email as string) || (l.email as string) || null,
        score: l._score,
        score_reasoning: l._reasoning,
        status: l._qualified ? "qualified" : "scored",
        source: "ai_discovery",
      }));

      const { data: insertedLeads, error: insertErr } = await supabase
        .from("leads")
        .insert(leadsToInsert)
        .select("id, score, status, business_name, contact_name, contact_email, city, industry, description, website");

      if (insertErr) throw new Error(`Failed to save leads: ${insertErr.message}`);

      // Sync Hub Telemetry: Fire new_lead events
      if (insertedLeads && insertedLeads.length > 0) {
        let leadsToReport = 0;
        for (const lead of insertedLeads) {
          if (lead.status === "qualified") {
            await reportEvent('new_lead', {
              label: `New lead — AI Discovery`,
              metadata: { source: "ai_discovery", email: lead.contact_email }
            });
            leadsToReport++;
          }
        }
        if (leadsToReport > 0) {
          await updateDailyMetrics({ newLeads: leadsToReport });
        }
      }

      // Update campaign counters
      await supabase.from("campaigns").update({
        leads_found: rawLeads.length,
        leads_qualified: qualifiedLeads.length,
        status: "outreach",
      }).eq("id", campaignId);

      // ── Step 5: Generate outreach messages for qualified leads ──
      const qualifiedInserted = insertedLeads?.filter((l) => l.status === "qualified") || [];

      if (qualifiedInserted.length > 0) {
        setState((s) => ({ ...s, stage: "generating_outreach", progress: `Generating outreach for ${qualifiedInserted.length} qualified leads...` }));

        let messagesGenerated = 0;

        for (let i = 0; i < qualifiedInserted.length; i++) {
          const lead = qualifiedInserted[i];
          setState((s) => ({ ...s, progress: `Writing outreach ${i + 1} of ${qualifiedInserted.length}...` }));

          const { data: emailData, error: emailErr } = await supabase.functions.invoke("generate-outreach", {
            body: { lead, companyProfile, tone },
          });

          if (emailErr || !emailData?.subject) continue;

          const { error: msgInsertErr } = await supabase.from("outreach_messages").insert({
            campaign_id: campaignId,
            company_id: companyId,
            lead_id: lead.id,
            subject: emailData.subject,
            body: emailData.body,
            channel: "email",
            email_type: "outreach",
            status: "pending_approval",
            ai_model_used: "gemini-3-flash",
          });

          if (!msgInsertErr) messagesGenerated++;
        }

        // Update campaign email counter
        await supabase.from("campaigns").update({
          emails_sent: messagesGenerated,
        }).eq("id", campaignId);

        setState((s) => ({ ...s, messagesGenerated }));
      }

      // ── Step 6: Finalize ──
      await supabase.from("campaigns").update({ status: "active" }).eq("id", campaignId);

      setState((s) => ({
        ...s,
        stage: "done",
        progress: `Pipeline complete! ${rawLeads.length} leads found, ${qualifiedLeads.length} qualified, ${s.messagesGenerated} messages drafted.`,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Pipeline failed";
      console.error("Campaign pipeline error:", err);
      setState((s) => ({ ...s, stage: "error", error: message, progress: message }));
    }
  }, []);

  return { ...state, runPipeline };
}
