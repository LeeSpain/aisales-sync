-- Fix: allow regular users to INSERT and UPDATE their own subscriptions
-- Previously only SELECT existed for users, and INSERT/UPDATE were admin-only.
-- This blocked the plan selection flow.

CREATE POLICY "Users can insert own subscription" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update own subscription" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
