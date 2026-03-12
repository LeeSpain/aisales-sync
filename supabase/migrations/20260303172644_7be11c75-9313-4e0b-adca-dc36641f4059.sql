
-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_description TEXT,
  target_criteria JSONB,
  geographic_focus TEXT,
  minimum_score DECIMAL DEFAULT 3.5,
  status TEXT DEFAULT 'setup' CHECK (status IN ('setup','hunting','scoring','outreach','active','paused','completed')),
  leads_found INTEGER DEFAULT 0,
  leads_qualified INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  website TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  country TEXT DEFAULT 'Spain',
  industry TEXT,
  description TEXT,
  rating DECIMAL,
  review_count INTEGER,
  size_estimate TEXT CHECK (size_estimate IN ('small','medium','large','enterprise')),
  contact_name TEXT,
  contact_role TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  score DECIMAL,
  score_reasoning TEXT,
  research_data JSONB,
  source TEXT DEFAULT 'manual' CHECK (source IN ('google_maps','serp','directory','manual','ai_discovery')),
  status TEXT DEFAULT 'discovered' CHECK (status IN ('discovered','scored','qualified','outreach_pending','contacted','replied','in_conversation','call_scheduled','call_completed','converted','rejected','unresponsive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Outreach emails
CREATE TABLE public.outreach_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  email_type TEXT DEFAULT 'initial' CHECK (email_type IN ('initial','follow_up_1','follow_up_2','reply')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','approved','scheduled','sent','opened','replied','bounced','failed')),
  ai_model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email replies
CREATE TABLE public.email_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outreach_email_id UUID REFERENCES public.outreach_emails(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_email TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  intent TEXT CHECK (intent IN ('interested','not_interested','question','call_request','out_of_office','other')),
  ai_draft_response TEXT,
  ai_draft_approved BOOLEAN DEFAULT false,
  sent_response TEXT,
  handled_by TEXT DEFAULT 'ai_auto' CHECK (handled_by IN ('ai_auto','ai_approved','human')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Calls
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  call_type TEXT DEFAULT 'outbound_ai' CHECK (call_type IN ('outbound_ai','inbound','scheduled')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  recording_url TEXT,
  transcript TEXT,
  summary TEXT,
  outcome TEXT CHECK (outcome IN ('interested','not_interested','follow_up_needed','meeting_booked','deal_closed','no_answer','voicemail')),
  next_steps TEXT,
  twilio_call_sid TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','failed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity log
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  plan TEXT CHECK (plan IN ('starter','growth','enterprise')),
  status TEXT DEFAULT 'trialing' CHECK (status IN ('active','past_due','cancelled','trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  setup_fee_paid BOOLEAN DEFAULT false,
  monthly_amount DECIMAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI config (admin only)
CREATE TABLE public.ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT CHECK (provider IN ('openai','anthropic','google')),
  model TEXT,
  api_key_encrypted TEXT,
  temperature DECIMAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,
  monthly_budget_cap DECIMAL,
  current_month_spend DECIMAL DEFAULT 0,
  purpose TEXT DEFAULT 'general' CHECK (purpose IN ('chat','research','email_writing','scoring','calls','general')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email config
CREATE TABLE public.email_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  sending_domain TEXT,
  sending_email TEXT,
  sender_name TEXT,
  provider TEXT CHECK (provider IN ('resend','ses','sendgrid')),
  api_key_encrypted TEXT,
  daily_send_limit INTEGER DEFAULT 20,
  warmup_status TEXT DEFAULT 'warming' CHECK (warmup_status IN ('warming','ready')),
  warmup_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_config ENABLE ROW LEVEL SECURITY;

-- Helper: get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

-- Campaigns RLS
CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert own campaigns" ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admins can manage campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Leads RLS
CREATE POLICY "Users can view own leads" ON public.leads FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update own leads" ON public.leads FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admins can manage leads" ON public.leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Outreach emails RLS
CREATE POLICY "Users can view own emails" ON public.outreach_emails FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update own emails" ON public.outreach_emails FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admins can manage emails" ON public.outreach_emails FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Email replies RLS
CREATE POLICY "Users can view own replies" ON public.email_replies FOR SELECT TO authenticated
  USING (lead_id IN (SELECT id FROM public.leads WHERE company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Users can update own replies" ON public.email_replies FOR UPDATE TO authenticated
  USING (lead_id IN (SELECT id FROM public.leads WHERE company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Admins can manage replies" ON public.email_replies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Calls RLS
CREATE POLICY "Users can view own calls" ON public.calls FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admins can manage calls" ON public.calls FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Activity log RLS (insert-only for clients)
CREATE POLICY "Users can view own activity" ON public.activity_log FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert activity" ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admins can manage activity" ON public.activity_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Subscriptions RLS
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admins can manage subscriptions" ON public.subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- AI config RLS (admin only)
CREATE POLICY "Admins can manage ai_config" ON public.ai_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Email config RLS
CREATE POLICY "Users can view own email_config" ON public.email_config FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update own email_config" ON public.email_config FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admins can manage email_config" ON public.email_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_config_updated_at BEFORE UPDATE ON public.ai_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_config_updated_at BEFORE UPDATE ON public.email_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_campaigns_company ON public.campaigns (company_id);
CREATE INDEX idx_leads_campaign ON public.leads (campaign_id);
CREATE INDEX idx_leads_company ON public.leads (company_id);
CREATE INDEX idx_leads_status ON public.leads (status);
CREATE INDEX idx_outreach_lead ON public.outreach_emails (lead_id);
CREATE INDEX idx_calls_company ON public.calls (company_id);
CREATE INDEX idx_activity_company ON public.activity_log (company_id, created_at DESC);
