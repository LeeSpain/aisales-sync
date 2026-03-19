-- Drop the overly permissive read policy that exposes key values to all authenticated users
DROP POLICY IF EXISTS "Authenticated users can read api_keys" ON public.api_keys;

-- Add admin-only SELECT policy
-- (The existing "Admins can manage api_keys" FOR ALL policy already covers admin SELECT,
--  but an explicit SELECT policy makes intent clear and survives if the ALL policy changes)
CREATE POLICY "Only admins can read api_keys"
  ON public.api_keys
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- service_role retains full access by default (bypasses RLS)
