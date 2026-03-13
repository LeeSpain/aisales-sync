-- Phase 4: Research memory & field-level provenance tables
-- Tracks every pipeline step per lead, stores scraped page content,
-- and records where each lead field value came from.

-- ═══════════════════════════════════════════════════════════════════
-- 1. lead_run_steps — per-lead step tracking within a pipeline run
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lead_run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id UUID NOT NULL REFERENCES public.pipeline_runs(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL CHECK (step_name IN (
    'discover', 'research', 'score', 'decision_makers', 'outreach'
  )),
  provider_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'skipped'
  )),
  input_summary TEXT,
  output_summary TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_lead_run_steps_run ON public.lead_run_steps(pipeline_run_id);
CREATE INDEX idx_lead_run_steps_lead ON public.lead_run_steps(lead_id);

ALTER TABLE public.lead_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own lead_run_steps"
  ON public.lead_run_steps
  FOR SELECT
  TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads
      WHERE company_id = public.get_user_company_id(auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════════
-- 2. scraped_pages — raw content fetched during research
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.scraped_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  pipeline_run_id UUID REFERENCES public.pipeline_runs(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  extraction_quality TEXT NOT NULL DEFAULT 'medium' CHECK (extraction_quality IN (
    'low', 'medium', 'high'
  )),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scraped_pages_lead ON public.scraped_pages(lead_id);
CREATE INDEX idx_scraped_pages_run ON public.scraped_pages(pipeline_run_id);

ALTER TABLE public.scraped_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scraped_pages"
  ON public.scraped_pages
  FOR SELECT
  TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads
      WHERE company_id = public.get_user_company_id(auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════════
-- 3. lead_field_provenance — traces each field value to its source
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lead_field_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_value TEXT NOT NULL,
  source_provider TEXT NOT NULL,
  source_url TEXT,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_field_provenance_lead ON public.lead_field_provenance(lead_id);
CREATE INDEX idx_lead_field_provenance_field ON public.lead_field_provenance(lead_id, field_name);

ALTER TABLE public.lead_field_provenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own lead_field_provenance"
  ON public.lead_field_provenance
  FOR SELECT
  TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads
      WHERE company_id = public.get_user_company_id(auth.uid())
    )
  );
