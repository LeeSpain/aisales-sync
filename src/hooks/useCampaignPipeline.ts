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

/**
 * Classify edge function errors into user-friendly messages.
 * Supabase JS client wraps failures as FunctionsHttpError, FunctionsRelayError,
 * or FunctionsFetchError depending on what went wrong.
 */
function classifyPipelineError(err: unknown): string {
  if (!(err instanceof Error)) return "Pipeline failed to start.";

  const msg = err.message || "";
  const name = err.name || "";

  // Network-level failure: function doesn't exist or isn't reachable
  if (
    name === "FunctionsFetchError" ||
    msg.includes("Failed to send a request") ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("TypeError")
  ) {
    return "Cannot reach the pipeline service. Check your internet connection and try again.";
  }

  // HTTP 404 — function not found
  if (msg.includes("404") || msg.includes("not found")) {
    return "Pipeline function not found. It may need to be deployed — contact support.";
  }

  // HTTP 401/403 — auth/secrets issue
  if (
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("Unauthorized") ||
    msg.includes("Forbidden") ||
    msg.includes("Invalid JWT")
  ) {
    return "Pipeline configuration error. API keys may not be set.";
  }

  // HTTP 503 — dead switch or service unavailable
  if (msg.includes("503") || msg.includes("disabled by admin")) {
    return "Pipeline is currently disabled by admin.";
  }

  // Anything else: show the actual message
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
      // ── Fire the pipeline edge function directly ──
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
        throw new Error("Pipeline did not return a run ID");
      }

      runIdRef.current = runId;

      // Start polling for progress updates
      pollingRef.current = setInterval(pollProgress, POLL_INTERVAL_MS);
      // Also do one immediate poll
      await pollProgress();
    } catch (err) {
      const message = classifyPipelineError(err);
      setState((s) => ({ ...s, stage: "error", error: message, progress: message }));
      isRunningRef.current = false;
    }
  }, [pollProgress]);

  return { ...state, runPipeline };
}
