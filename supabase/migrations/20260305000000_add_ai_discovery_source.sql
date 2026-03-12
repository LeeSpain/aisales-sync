-- Add 'ai_discovery' to the leads.source check constraint
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_source_check
  CHECK (source IN ('google_maps','serp','directory','manual','ai_discovery'));
