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
  | "enriching"
  | "generating_emails"
  | "generating_linkedin"
  | "generating_calls"
  | "quality_check"
  | "finalizing"
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
  startedAt: number | null;
  cancelled: boolean;
}

interface RunPipelineParams {
  campaignId: string;
  companyId: string;
  targetCriteria: Record<string, unknown>;
  geographicFocus: string;
  minimumScore: number;
  tone: string;
}

const POLL_INTERVAL_MS = 2000;

/** Map backend stage names to frontend PipelineStage */
function mapStage(backendStage: string): PipelineStage {
  const map: Record<string, PipelineStage> = {
    discovering: "discovering",
    saving_leads: "saving_leads",
    researching: "researching",
    scoring: "scoring",
    decision_makers: "decision_makers",
    enriching: "enriching",
    generating_emails: "generating_emails",
    generating_linkedin: "generating_linkedin",
    generating_calls: "generating_calls",
    quality_check: "quality_check",
    finalizing: "finalizing",
    completed: "done",
    failed: "error",
  };
  return map[backendStage] || "discovering";
}

/** All stages in order for the progress tracker */
export const PIPELINE_STAGES = [
  { key: "discovering", label: "Discovery", emoji: "🔍" },
  { key: "researching", label: "Research", emoji: "🌐" },
  { key: "scoring", label: "Scoring", emoji: "⭐" },
  { key: "decision_makers", label: "Decision Makers", emoji: "🕵️" },
  { key: "enriching", label: "Enrichment", emoji: "🔬" },
  { key: "generating_emails", label: "Email Drafts", emoji: "✉️" },
  { key: "generating_linkedin", label: "LinkedIn Drafts", emoji: "💼" },
  { key: "generating_calls", label: "Call Scripts", emoji: "📞" },
  { key: "quality_check", label: "Quality Check", emoji: "🔍" },
  { key: "finalizing", label: "Finalize", emoji: "🎯" },
] as const;

/**
 * Classify edge function errors into user-friendly messages.
 */
function classifyPipelineError(err: unknown): string {
  if (!(err instanceof Error)) return "Pipeline failed to start.";

  const msg = err.message || "";
  const name = err.name || "";

  if (
    name === "FunctionsFetchError" ||
    msg.includes("Failed to send a request") ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("TypeError")
  ) {
    return "Cannot reach the pipeline service. Check your internet connection and try again.";
  }

  if (msg.includes("404") || msg.includes("not found")) {
    return "Pipeline function not found. It may need to be deployed — contact support.";
  }

  if (msg.includes("401") || msg.includes("403") || msg.includes("Unauthorized") || msg.includes("Forbidden")) {
    return "Authentication error. Please log out and log back in, then try again.";
  }

  if (msg.includes("503") || msg.includes("disabled by admin")) {
    return "Pipeline is currently disabled by admin.";
  }

  if (msg.includes("500") || msg.includes("Internal")) {
    return "Pipeline encountered a server error. Check the Supabase dashboard for details.";
  }

  return msg;
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
    startedAt: null,
    cancelled: false,
  });

  const runIdRef = useRef<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);
  const cancelledRef = useRef(false);

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

    setState((prev) => ({
      ...prev,
      stage: mapStage(data.current_stage),
      progress: data.progress_message,
      leadsFound: data.leads_discovered ?? prev.leadsFound,
      leadsQualified: data.leads_qualified ?? prev.leadsQualified,
      messagesGenerated: data.messages_generated ?? prev.messagesGenerated,
      error: data.error_message,
    }));

    // Stop polling when pipeline is done
    if (data.status === "completed" || data.status === "failed") {
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
  // The edge function returns the run_id immediately and processes in the
  // background. We start polling pipeline_runs right away so the user sees
  // real-time stage progress.
  const runPipeline = useCallback(async (params: RunPipelineParams) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    cancelledRef.current = false;

    setState({
      stage: "discovering",
      progress: "Starting pipeline...",
      leadsFound: 0,
      leadsQualified: 0,
      messagesGenerated: 0,
      error: null,
      runId: null,
      startedAt: Date.now(),
      cancelled: false,
    });

    try {
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
        throw invokeErr;
      }

      const runId = data?.run_id as string | undefined;
      if (!runId) {
        throw new Error("Pipeline did not return a run ID. Check edge function logs.");
      }

      runIdRef.current = runId;
      setState((s) => ({ ...s, runId }));

      // Start polling immediately — the pipeline is running in the background
      pollingRef.current = setInterval(pollProgress, POLL_INTERVAL_MS);
      await pollProgress();
    } catch (err) {
      const message = classifyPipelineError(err);
      setState((s) => ({ ...s, stage: "error", error: message, progress: message }));
      isRunningRef.current = false;
    }
  }, [pollProgress]);

  // ── Cancel pipeline ──
  const cancelPipeline = useCallback(async () => {
    cancelledRef.current = true;
    const runId = runIdRef.current;

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

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
  }, []);

  // ── Resume polling for an existing run ──
  const resumePolling = useCallback((runId: string) => {
    runIdRef.current = runId;
    isRunningRef.current = true;
    setState((s) => ({ ...s, runId, stage: "discovering", progress: "Reconnecting to pipeline..." }));
    pollingRef.current = setInterval(pollProgress, POLL_INTERVAL_MS);
    pollProgress();
  }, [pollProgress]);

  return {
    ...state,
    runPipeline,
    cancelPipeline,
    resumePolling,
    isRunning: isRunningRef.current || (state.stage !== "idle" && state.stage !== "done" && state.stage !== "error"),
  };
}
