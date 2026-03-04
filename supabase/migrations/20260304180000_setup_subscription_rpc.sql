-- Single RPC function to handle the entire plan activation flow.
-- Runs as SECURITY DEFINER to bypass all RLS policies.
-- Creates profile + company if missing, then creates/updates subscription.

CREATE OR REPLACE FUNCTION public.activate_plan(
  p_plan TEXT,
  p_is_trial BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_full_name TEXT;
  v_company_id UUID;
  v_sub_id UUID;
  v_monthly INT;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user info from auth
  SELECT email, raw_user_meta_data->>'full_name'
  INTO v_email, v_full_name
  FROM auth.users WHERE id = v_user_id;

  -- Ensure profile exists
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (v_user_id, v_email, COALESCE(v_full_name, ''))
  ON CONFLICT (id) DO NOTHING;

  -- Check if user already has a company
  SELECT company_id INTO v_company_id FROM public.profiles WHERE id = v_user_id;

  -- Create company if needed
  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (name, owner_id, status)
    VALUES (COALESCE(NULLIF(v_full_name, ''), split_part(v_email, '@', 1)) || '''s Company', v_user_id, 'active')
    RETURNING id INTO v_company_id;

    UPDATE public.profiles SET company_id = v_company_id WHERE id = v_user_id;
  END IF;

  -- Ensure client role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'client')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Calculate plan details
  v_monthly := CASE p_plan WHEN 'starter' THEN 750 WHEN 'growth' THEN 1250 ELSE 0 END;
  v_status := CASE WHEN p_is_trial THEN 'trialing' ELSE 'active' END;

  -- Create or update subscription
  SELECT id INTO v_sub_id FROM public.subscriptions WHERE company_id = v_company_id LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    UPDATE public.subscriptions SET
      plan = p_plan,
      status = v_status,
      monthly_amount = v_monthly,
      setup_fee_paid = NOT p_is_trial,
      current_period_start = now(),
      current_period_end = now() + (CASE WHEN p_is_trial THEN INTERVAL '14 days' ELSE INTERVAL '30 days' END)
    WHERE id = v_sub_id;
  ELSE
    INSERT INTO public.subscriptions (company_id, plan, status, monthly_amount, setup_fee_paid, current_period_start, current_period_end)
    VALUES (
      v_company_id, p_plan, v_status, v_monthly, NOT p_is_trial,
      now(), now() + (CASE WHEN p_is_trial THEN INTERVAL '14 days' ELSE INTERVAL '30 days' END)
    );
  END IF;

  -- Log activity
  INSERT INTO public.activity_log (company_id, action, description, metadata)
  VALUES (
    v_company_id,
    'subscription_activated',
    (CASE WHEN p_is_trial THEN 'Trial' ELSE 'Subscription' END) || ' activated on ' || p_plan || ' plan',
    jsonb_build_object('plan', p_plan, 'monthly_amount', v_monthly, 'is_trial', p_is_trial)
  );

  RETURN v_company_id;
END;
$$;
