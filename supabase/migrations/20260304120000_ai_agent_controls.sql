-- Add system_prompt and metadata columns to ai_config for admin AI agent controls
ALTER TABLE public.ai_config
  ADD COLUMN IF NOT EXISTS system_prompt TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.ai_config.system_prompt IS 'Editable system prompt for AI agent contexts (onboarding, campaign_setup, dashboard, etc.)';
COMMENT ON COLUMN public.ai_config.metadata IS 'Flexible JSONB config for autonomy rules, agent descriptions, and other settings';
