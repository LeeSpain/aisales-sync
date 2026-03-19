-- Add contact_source to track where contact info was discovered
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS contact_source text DEFAULT NULL;

COMMENT ON COLUMN leads.contact_source IS 'Where the contact info came from: apollo, hunter, serper, ai_guess, manual';

-- Index for filtering leads by contact data source
CREATE INDEX IF NOT EXISTS idx_leads_contact_source
  ON leads (contact_source)
  WHERE contact_source IS NOT NULL;
