-- Add email verification tracking to leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email_verification_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contact_confidence text DEFAULT NULL;

COMMENT ON COLUMN leads.email_verification_status IS 'Email verification result: valid, invalid, risky, unknown, or null (not checked)';
COMMENT ON COLUMN leads.contact_confidence IS 'How confident are we in the contact info: verified, likely, guessed, or null';

-- Add blocked_reason to outreach_messages (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outreach_messages') THEN
    ALTER TABLE outreach_messages ADD COLUMN IF NOT EXISTS blocked_reason text DEFAULT NULL;
    COMMENT ON COLUMN outreach_messages.blocked_reason IS 'Reason the outreach was blocked from sending (e.g. invalid email, low confidence)';
  END IF;
END $$;

-- Index for quick lookups of blocked/invalid email leads
CREATE INDEX IF NOT EXISTS idx_leads_email_verification_status
  ON leads (email_verification_status)
  WHERE email_verification_status IS NOT NULL;
