-- Phase 5: Add scraper provider default rows to provider_configs
-- These appear in the admin UI as "coming soon" (is_enabled = false)
-- The CHECK constraint on provider_configs already allows these values

INSERT INTO public.provider_configs (company_id, provider_name, is_enabled, priority) VALUES
  (NULL, 'playwright',  false, 4),
  (NULL, 'crawl4ai',    false, 5),
  (NULL, 'scrapy',      false, 6)
ON CONFLICT (company_id, provider_name) DO NOTHING;
