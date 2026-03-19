-- ============================================================
-- AI Sales Sync — Seed Script: Two Dashboard Users
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================
-- Super Admin: leewakeman@hotmail.co.uk / test1234
-- Client Admin: test@tes.com / test1234
-- ============================================================

-- Generate UUIDs for all records
DO $$
DECLARE
  v_super_admin_id uuid;
  v_client_admin_id uuid;
  v_super_company_id uuid;
  v_client_company_id uuid;
  v_super_sub_id uuid;
  v_client_sub_id uuid;
BEGIN

  -- ── 1. Check if users already exist, delete if so (clean slate) ──
  -- Remove existing data for these emails
  DELETE FROM public.user_roles WHERE user_id IN (
    SELECT id FROM auth.users WHERE email IN ('leewakeman@hotmail.co.uk', 'test@tes.com')
  );
  DELETE FROM public.subscriptions WHERE company_id IN (
    SELECT company_id FROM public.profiles WHERE id IN (
      SELECT id FROM auth.users WHERE email IN ('leewakeman@hotmail.co.uk', 'test@tes.com')
    )
  );
  DELETE FROM public.profiles WHERE id IN (
    SELECT id FROM auth.users WHERE email IN ('leewakeman@hotmail.co.uk', 'test@tes.com')
  );
  DELETE FROM public.companies WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email IN ('leewakeman@hotmail.co.uk', 'test@tes.com')
  );
  DELETE FROM auth.identities WHERE user_id IN (
    SELECT id FROM auth.users WHERE email IN ('leewakeman@hotmail.co.uk', 'test@tes.com')
  );
  DELETE FROM auth.users WHERE email IN ('leewakeman@hotmail.co.uk', 'test@tes.com');

  -- ── 2. Create auth users ──
  v_super_admin_id := gen_random_uuid();
  v_client_admin_id := gen_random_uuid();

  -- Super Admin user
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_super_admin_id,
    'authenticated',
    'authenticated',
    'leewakeman@hotmail.co.uk',
    crypt('test1234', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Lee Wakeman"}',
    now(), now(), '', '', '', ''
  );

  -- Client Admin user
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_client_admin_id,
    'authenticated',
    'authenticated',
    'test@tes.com',
    crypt('test1234', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Test Client"}',
    now(), now(), '', '', '', ''
  );

  -- ── 3. Create auth identities (required for Supabase auth to work) ──
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_super_admin_id,
    v_super_admin_id,
    jsonb_build_object('sub', v_super_admin_id::text, 'email', 'leewakeman@hotmail.co.uk', 'email_verified', true, 'phone_verified', false),
    'email',
    v_super_admin_id::text,
    now(), now(), now()
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_client_admin_id,
    v_client_admin_id,
    jsonb_build_object('sub', v_client_admin_id::text, 'email', 'test@tes.com', 'email_verified', true, 'phone_verified', false),
    'email',
    v_client_admin_id::text,
    now(), now(), now()
  );

  -- ── 4. Create companies ──
  v_super_company_id := gen_random_uuid();
  v_client_company_id := gen_random_uuid();

  INSERT INTO public.companies (id, name, owner_id, industry, description, status, created_at, updated_at)
  VALUES (
    v_super_company_id,
    'AI Sales Sync HQ',
    v_super_admin_id,
    'SaaS / Technology',
    'Platform owner — Super Admin account',
    'active',
    now(), now()
  );

  INSERT INTO public.companies (id, name, owner_id, industry, description, status, created_at, updated_at)
  VALUES (
    v_client_company_id,
    'Test Client Ltd',
    v_client_admin_id,
    'Marketing',
    'Demo client business account',
    'active',
    now(), now()
  );

  -- ── 5. Update profiles (auto-created by Supabase trigger, just update fields) ──
  UPDATE public.profiles SET
    email = 'leewakeman@hotmail.co.uk',
    full_name = 'Lee Wakeman',
    company_id = v_super_company_id,
    onboarding_completed = true,
    updated_at = now()
  WHERE id = v_super_admin_id;

  UPDATE public.profiles SET
    email = 'test@tes.com',
    full_name = 'Test Client',
    company_id = v_client_company_id,
    onboarding_completed = true,
    updated_at = now()
  WHERE id = v_client_admin_id;

  -- ── 6. Create subscriptions (active trial, bypasses flow gating) ──
  INSERT INTO public.subscriptions (id, company_id, plan, status, monthly_amount, current_period_start, current_period_end, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_super_company_id,
    'enterprise',
    'active',
    0,
    now(),
    now() + interval '1 year',
    now(), now()
  );

  INSERT INTO public.subscriptions (id, company_id, plan, status, monthly_amount, current_period_start, current_period_end, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_client_company_id,
    'growth',
    'trialing',
    1250,
    now(),
    now() + interval '14 days',
    now(), now()
  );

  -- ── 7. Set user roles (delete trigger-created defaults first) ──
  DELETE FROM public.user_roles WHERE user_id IN (v_super_admin_id, v_client_admin_id);

  INSERT INTO public.user_roles (id, user_id, role)
  VALUES (gen_random_uuid(), v_super_admin_id, 'admin');

  INSERT INTO public.user_roles (id, user_id, role)
  VALUES (gen_random_uuid(), v_client_admin_id, 'client');

  RAISE NOTICE '✅ Setup complete!';
  RAISE NOTICE 'Super Admin: leewakeman@hotmail.co.uk / test1234 → /admin dashboard';
  RAISE NOTICE 'Client Admin: test@tes.com / test1234 → /dashboard';
  RAISE NOTICE 'Super Admin ID: %', v_super_admin_id;
  RAISE NOTICE 'Client Admin ID: %', v_client_admin_id;

END $$;
