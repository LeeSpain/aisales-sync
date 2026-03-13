import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type PipelineStage =
  | "idle"
  | "discovering"
  | "saving_leads"
  | "researching"
  | "scoring"
  | "decision_makers"
  | "generating_outreach"
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

// Shape of a pipeline_runs row from the database
interface PipelineRun {
  id: string;
  campaign_id: string;
  company_id: string;
  status: "running" | "completed" | "failed";
  current_stage: string;
  progress_message: string;
  leads_discovered: number;
  leads_qualified: number;
  messages_generated: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

const POLL_INTERVAL_MS = 3000;

/** Map backend stage names to frontend PipelineStage */
function mapStage(backendStage: string): PipelineStage {
  switch (backendStage) {
    case "discovering":       return "discovering";
    case "saving_leads":      return "saving_leads";
    case "researching":       return "researching";
    case "scoring":           return "scoring";
    case "decision_makers":   return "decision_makers";
    case "generating_outreach": return "generating_outreach";
    case "completed":         return "done";
    case "failed":            return "error";
    default:                  return "discovering";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useCampaignPipeline() {
  const [state, setState] = useState<PipelineState>({
    stage: "idle",
    progress: "",
    leadsFound: 0,
    leadsQualified: 0,
    messagesGenerated: 0,
    error: null,
  });

  const runIdRef = useRef<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);

  // ── Poll pipeline_runs for progress ──
  const pollProgress = useCallback(async () => {
    const runId = runIdRef.current;
    if (!runId) return;

    const { data, error } = await supabase
      .from("pipeline_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();

    if (error || !data) return;

    const run = data;

    setState({
      stage: mapStage(run.current_stage),
      progress: run.progress_message,
      leadsFound: run.leads_discovered,
      leadsQualified: run.leads_qualified,
      messagesGenerated: run.messages_generated,
      error: run.error_message,
    });

    // Stop polling when pipeline is done
    if (run.status === "completed" || run.status === "failed") {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      runIdRef.current = null;
      isRunningRef.current = false;
    }
  }, []);

  // ── Clean up polling on unmount ──
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  // ── Start pipeline ──
  const runPipeline = useCallback(async (params: RunPipelineParams) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    setState({
      stage: "discovering",
      progress: "Starting pipeline...",
      leadsFound: 0,
      leadsQualified: 0,
      messagesGenerated: 0,
      error: null,
    });

    try {
      // Fire the edge function — it creates pipeline_runs and runs the full pipeline
      const { data, error: invokeErr } = await supabase.functions.invoke(
        "run-campaign-pipeline",
        {
          body: {
            campaignId: params.campaignId,
            companyId: params.companyId,
            targetCriteria: params.targetCriteria,
            geographicFocus: params.geographicFocus,
            minimumScore: params.minimumScore,
            tone: params.tone,
          },
        }
      );

      if (invokeErr) {
        throw new Error(invokeErr.message || "Failed to start pipeline");
      }

      const runId = data?.run_id as string | undefined;
      if (!runId) {
        throw new Error("Pipeline did not return a run ID");
      }

      runIdRef.current = runId;

      // Start polling for progress updates
      pollingRef.current = setInterval(pollProgress, POLL_INTERVAL_MS);
      // Also do one immediate poll
      await pollProgress();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Pipeline failed to start";
      setState((s) => ({ ...s, stage: "error", error: message, progress: message }));
      isRunningRef.current = false;
    }
  }, [pollProgress]);

  return { ...state, runPipeline };
}
