-- Create a dedicated table for storing third-party API keys
-- This replaces the workaround of cramming keys into ai_config

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT NOT NULL,
  key_value TEXT NOT NULL,
  label TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only admins can access api_keys
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage api_keys" ON public.api_keys
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Edge functions (service role) can read api_keys
CREATE POLICY "Service role can read api_keys" ON public.api_keys
  FOR SELECT TO service_role
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the Serper API key (update these values as needed)
-- INSERT INTO public.api_keys (key_name, key_value, label, is_active)
-- VALUES ('SERPER_API_KEY', 'your-key-here', 'Serper Google Search API', true);
