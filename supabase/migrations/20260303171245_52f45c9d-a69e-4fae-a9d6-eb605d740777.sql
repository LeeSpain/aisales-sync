
-- Fix permissive INSERT policy on companies - restrict to authenticated users inserting for themselves
DROP POLICY "Users can insert company" ON public.companies;
CREATE POLICY "Users can insert own company" ON public.companies FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
