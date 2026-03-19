-- Add primary contact info and outreach language preferences to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_role TEXT,
  ADD COLUMN IF NOT EXISTS outreach_languages TEXT[] DEFAULT '{}';
