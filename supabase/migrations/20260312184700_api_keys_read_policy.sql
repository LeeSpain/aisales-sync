-- Allow all authenticated users to READ api_keys
-- (needed so the campaign pipeline can read the Serper API key)
-- Admins already have full access via the existing "Admins can manage api_keys" policy

CREATE POLICY "Authenticated users can read api_keys"
  ON public.api_keys
  FOR SELECT
  TO authenticated
  USING (is_active = true);
