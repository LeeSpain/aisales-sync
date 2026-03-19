-- Pipeline runs table — tracks server-side pipeline execution progress
-- The frontend polls this table to display real-time progress updates

CREATE TABLE IF NOT EXISTS public.pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  current_stage TEXT NOT NULL DEFAULT 'discovering',
  progress_message TEXT NOT NULL DEFAULT '',
  leads_discovered INTEGER NOT NULL DEFAULT 0,
  leads_processed INTEGER NOT NULL DEFAULT 0,
  leads_qualified INTEGER NOT NULL DEFAULT 0,
  messages_generated INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for polling queries (frontend polls by campaign_id)
CREATE INDEX idx_pipeline_runs_campaign ON public.pipeline_runs(campaign_id);

-- Enable RLS
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;

-- Users can read pipeline runs for their own company
CREATE POLICY "Users can read own pipeline_runs"
  ON public.pipeline_runs
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Service role has full access (bypasses RLS by default)
-- The edge function uses service_role to write progress updates
