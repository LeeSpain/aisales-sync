import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PipelineStage =
  | "idle"
  | "discovering"
  | "scoring"
  | "researching"
  | "outreach"
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
  maxLeads?: number;
}

interface PipelineRunSnapshot {
  current_stage: string;
  progress_message: string;
  leads_discovered: number;
  leads_qualified: number;
  messages_generated: number;
  status: string;
  error_message: string | null;
}

const mapRunStageToUiStage = (stage: string, status: string): PipelineStage => {
  if (status === "failed" || stage === "failed") return "error";
  if (status === "completed" || stage === "completed") return "done";
  if (stage === "discovering" || stage === "saving_leads") return "discovering";
  if (stage === "researching" || stage === "decision_makers") return "researching";
  if (stage === "scoring") return "scoring";
  if (stage === "generating_outreach") return "outreach";
  return "discovering";
};

const applyRunState = (run: PipelineRunSnapshot): PipelineState => ({
  stage: mapRunStageToUiStage(run.current_stage, run.status),
  progress: run.progress_message || "Running campaign pipeline...",
  leadsFound: run.leads_discovered ?? 0,
  leadsQualified: run.leads_qualified ?? 0,
  messagesGenerated: run.messages_generated ?? 0,
  error: run.error_message,
});

export function useCampaignPipeline() {
  const [state, setState] = useState<PipelineState>({
    stage: "idle",
    progress: "",
    leadsFound: 0,
    leadsQualified: 0,
    messagesGenerated: 0,
    error: null,
  });
  const isRunningRef = useRef(false);
  const pollTimeoutRef = useRef<number | null>(null);

  const clearPollTimeout = () => {
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  };

  const pollRunStatus = useCallback(async (runId: string) => {
    while (true) {
      const { data: run, error } = await supabase
        .from("pipeline_runs")
        .select("current_stage, progress_message, leads_discovered, leads_qualified, messages_generated, status, error_message")
        .eq("id", runId)
        .single();

      if (error || !run) {
        throw new Error(error?.message || "Failed to read pipeline status");
      }

      setState(applyRunState(run));

      if (run.status === "completed" || run.status === "failed") {
        return;
      }

      await new Promise<void>((resolve) => {
        pollTimeoutRef.current = window.setTimeout(resolve, 1500);
      });
    }
  }, []);

  const runPipeline = useCallback(async (params: RunPipelineParams) => {
    const { campaignId, companyId, targetCriteria, geographicFocus, minimumScore, tone, maxLeads } = params;

    if (isRunningRef.current) return;
    isRunningRef.current = true;
    clearPollTimeout();
    setState({
      stage: "discovering",
      progress: "Starting pipeline...",
      leadsFound: 0,
      leadsQualified: 0,
      messagesGenerated: 0,
      error: null,
    });

    try {
      const { data, error } = await supabase.functions.invoke("run-campaign-pipeline", {
        body: {
          campaignId,
          companyId,
          targetCriteria,
          geographicFocus,
          minimumScore,
          tone,
          maxLeads: maxLeads ?? 25,
        },
      });

      if (error) {
        throw new Error(error.message || "Pipeline failed to start");
      }

      const runId = data?.run_id as string | undefined;
      if (!runId) {
        throw new Error("Pipeline started without a run ID");
      }

      await pollRunStatus(runId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Pipeline failed";
      console.error("Campaign pipeline error:", err);
      await supabase.from("campaigns").update({ status: "error" }).eq("id", campaignId);
      setState({
        stage: "error",
        progress: message,
        leadsFound: 0,
        leadsQualified: 0,
        messagesGenerated: 0,
        error: message,
      });
    } finally {
      clearPollTimeout();
      isRunningRef.current = false;
    }
  }, [pollRunStatus]);

  return { ...state, runPipeline };
}
