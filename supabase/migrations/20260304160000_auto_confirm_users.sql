-- Fix signup flow: auto-confirm users + create company in trigger
-- The trigger runs as SECURITY DEFINER, bypassing RLS entirely.
-- By the time the user reaches SelectPlan, profile + company already exist.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id UUID;
  display_name TEXT;
BEGIN
  -- Try to auto-confirm email (may fail if insufficient permissions)
  BEGIN
    UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  display_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1));

  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  -- Create default company for this user
  INSERT INTO public.companies (name, owner_id, status)
  VALUES (display_name || '''s Company', NEW.id, 'active')
  RETURNING id INTO new_company_id;

  -- Link profile to company
  UPDATE public.profiles SET company_id = new_company_id WHERE id = NEW.id;

  -- Assign default client role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Also add a SELECT policy so users can see companies they own (before profile is linked)
-- This fixes the edge case where client code creates a company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view owned company' AND tablename = 'companies'
  ) THEN
    CREATE POLICY "Users can view owned company" ON public.companies
      FOR SELECT TO authenticated USING (owner_id = auth.uid());
  END IF;
END $$;
