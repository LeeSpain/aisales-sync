import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type PipelineStage =
  | "idle"
  | "discovering"
  | "researching"
  | "scoring"
  | "contacts"
  | "emails"
  | "done"
  | "error";

export interface PipelineState {
  stage: PipelineStage;
  progress: string;
  leadsFound: number;
  leadsQualified: number;
  messagesGenerated: number;
  error: string | null;
  runId: string | null;
  cancelled: boolean;
}

interface RunPipelineParams {
  campaignId: string;
  companyId: string;
  targetCriteria: Record<string, unknown>;
  geographicFocus: string;
  minimumScore: number;
  tone: string;
  maxLeads?: number;
}

/** 5 user-visible pipeline stages */
export const PIPELINE_STAGES = [
  { key: "discovering" as const, label: "Finding businesses", num: 1 },
  { key: "researching" as const, label: "Researching websites", num: 2 },
  { key: "scoring" as const, label: "Scoring leads", num: 3 },
  { key: "contacts" as const, label: "Finding contacts", num: 4 },
  { key: "emails" as const, label: "Writing emails", num: 5 },
] as const;

const POLL_MS = 2000;

/** Map backend stage to one of our 5 visible stages */
function mapStage(backendStage: string, status: string): PipelineStage {
  if (status === "failed" || backendStage === "failed") return "error";
  if (status === "completed" || backendStage === "completed") return "done";

  switch (backendStage) {
    case "discovering":
    case "saving_leads":
      return "discovering";
    case "researching":
      return "researching";
    case "scoring":
      return "scoring";
    case "decision_makers":
    case "enriching":
      return "contacts";
    case "generating_outreach":
    case "generating_emails":
    case "generating_linkedin":
    case "generating_calls":
    case "quality_check":
    case "finalizing":
      return "emails";
    default:
      return "discovering";
  }
}

/** Get the numeric stage (1-5) for progress bar */
export function stageNumber(stage: PipelineStage): number {
  const map: Record<string, number> = {
    discovering: 1, researching: 2, scoring: 3, contacts: 4, emails: 5, done: 5, error: 0,
  };
  return map[stage] || 0;
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
    runId: null,
    cancelled: false,
  });

  const runIdRef = useRef<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollProgress = useCallback(async () => {
    const runId = runIdRef.current;
    if (!runId) return;

    const { data, error } = await supabase
      .from("pipeline_runs")
      .select("current_stage, progress_message, leads_discovered, leads_qualified, messages_generated, status, error_message")
      .eq("id", runId)
      .maybeSingle();

    if (error || !data) return;

    setState((prev) => ({
      ...prev,
      stage: mapStage(data.current_stage, data.status),
      progress: data.progress_message || prev.progress,
      leadsFound: data.leads_discovered ?? prev.leadsFound,
      leadsQualified: data.leads_qualified ?? prev.leadsQualified,
      messagesGenerated: data.messages_generated ?? prev.messagesGenerated,
      error: data.error_message,
    }));

    if (data.status === "completed" || data.status === "failed") {
      stopPolling();
      runIdRef.current = null;
      isRunningRef.current = false;
    }
  }, [stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

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
      runId: null,
      cancelled: false,
    });

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("run-campaign-pipeline", {
        body: {
          campaignId: params.campaignId,
          companyId: params.companyId,
          targetCriteria: params.targetCriteria,
          geographicFocus: params.geographicFocus,
          minimumScore: params.minimumScore,
          tone: params.tone,
          maxLeads: params.maxLeads ?? 25,
        },
      });

      if (invokeErr) throw invokeErr;

      const runId = data?.run_id as string | undefined;
      if (!runId) throw new Error("Pipeline did not return a run ID");

      runIdRef.current = runId;
      setState((s) => ({ ...s, runId }));

      pollingRef.current = setInterval(pollProgress, POLL_MS);
      await pollProgress();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Pipeline failed to start";
      setState((s) => ({ ...s, stage: "error", error: message, progress: message }));
      isRunningRef.current = false;
    }
  }, [pollProgress]);

  const cancelPipeline = useCallback(async () => {
    const runId = runIdRef.current;
    stopPolling();

    if (runId) {
      await supabase.from("pipeline_runs").update({
        status: "failed",
        current_stage: "failed",
        progress_message: "Cancelled by user",
        error_message: "Pipeline cancelled by user",
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
    }

    setState((s) => ({
      ...s,
      stage: "error",
      progress: "Pipeline cancelled",
      error: "Cancelled by user. Your progress has been saved.",
      cancelled: true,
    }));

    runIdRef.current = null;
    isRunningRef.current = false;
  }, [stopPolling]);

  const isRunning = state.stage !== "idle" && state.stage !== "done" && state.stage !== "error";

  return { ...state, runPipeline, cancelPipeline, isRunning };
}
