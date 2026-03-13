-- Provider configurations — separates "which providers are enabled" from secrets
-- Secrets stay in api_keys; this table holds only non-secret config and toggle state

CREATE TABLE IF NOT EXISTS public.provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL CHECK (provider_name IN (
    'serper', 'google_places', 'apollo', 'linkedin_session',
    'playwright', 'crawl4ai', 'scrapy'
  )),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 0,
  config_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (company_id, provider_name)
);

-- Index for lookup by provider
CREATE INDEX idx_provider_configs_provider ON public.provider_configs(provider_name);

-- Enable RLS
ALTER TABLE public.provider_configs ENABLE ROW LEVEL SECURITY;

-- Admins can read and write all rows
CREATE POLICY "Admins can manage provider_configs"
  ON public.provider_configs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can read their own company rows and global defaults (company_id IS NULL)
CREATE POLICY "Users can read own provider_configs"
  ON public.provider_configs
  FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL
    OR company_id = public.get_user_company_id(auth.uid())
  );

-- Service role has full access (bypasses RLS by default)

-- Insert global default rows (company_id = null)
INSERT INTO public.provider_configs (company_id, provider_name, is_enabled, priority) VALUES
  (NULL, 'serper',        false, 1),
  (NULL, 'google_places', false, 2),
  (NULL, 'apollo',        false, 3)
ON CONFLICT (company_id, provider_name) DO NOTHING;
