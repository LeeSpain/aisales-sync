-- Normalize Serper API key_name to lowercase convention
-- Fixes mismatch: AdminSettings saved as SERP_API_KEY, pipeline queried SERPER_API_KEY
UPDATE public.api_keys
SET key_name = 'serper_api_key', updated_at = now()
WHERE key_name IN ('SERP_API_KEY', 'SERPER_API_KEY')
  AND key_name != 'serper_api_key';
