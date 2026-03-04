-- Auto-confirm new users on signup (skip email verification)
-- Wraps auto-confirm in exception handler so profile creation still works
-- even if the auth.users update fails due to permissions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to auto-confirm email (may fail if insufficient permissions on auth schema)
  BEGIN
    UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- Silently continue — email confirmation can be disabled in Supabase dashboard instead
    NULL;
  END;

  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  -- Assign default client role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
