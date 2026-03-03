-- Phase 2: Version 2.0 Schema Updates

-- 1. Modify Campaigns Table
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS meetings_booked INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS proposals_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS deals_won INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_meetings_per_week INTEGER,
ADD COLUMN IF NOT EXISTS target_proposals_per_week INTEGER,
ADD COLUMN IF NOT EXISTS target_closings_per_month INTEGER,
ADD COLUMN IF NOT EXISTS estimated_deal_value DECIMAL;

-- 2. Modify Leads Table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS contact_linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS enrichment_source TEXT;

-- 3. New Table: Sequence Templates
CREATE TABLE public.sequence_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_by TEXT CHECK (created_by IN ('ai', 'manual')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. New Table: Sequence Steps
CREATE TABLE public.sequence_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.sequence_templates(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    channel TEXT CHECK (channel IN ('email', 'linkedin_connect', 'linkedin_message', 'call', 'sms', 'whatsapp')),
    delay_days INTEGER DEFAULT 0,
    step_type TEXT CHECK (step_type IN ('initial_email', 'follow_up', 'value_add', 'breakup', 'linkedin_connect', 'linkedin_message', 'call_intro', 'call_follow_up')),
    ai_instructions TEXT,
    subject_template TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Modify Outreach Emails to Outreach Messages
ALTER TABLE public.outreach_emails RENAME TO outreach_messages;
ALTER TABLE public.outreach_messages 
ADD COLUMN IF NOT EXISTS sequence_step_id UUID REFERENCES public.sequence_steps(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS channel TEXT CHECK (channel IN ('email', 'linkedin_connect', 'linkedin_message', 'call', 'sms', 'whatsapp')) DEFAULT 'email';

ALTER TABLE public.outreach_messages DROP CONSTRAINT IF EXISTS outreach_emails_status_check;
ALTER TABLE public.outreach_messages ADD CONSTRAINT outreach_messages_status_check CHECK (status IN ('draft', 'approved', 'scheduled', 'sent', 'opened', 'replied', 'bounced', 'failed', 'pending_manual'));

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_outreach_lead') THEN
        ALTER INDEX idx_outreach_lead RENAME TO idx_outreach_messages_lead;
    END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own emails" ON public.outreach_messages;
DROP POLICY IF EXISTS "Users can update own emails" ON public.outreach_messages;
DROP POLICY IF EXISTS "Admins can manage emails" ON public.outreach_messages;

CREATE POLICY "Users can view own messages" ON public.outreach_messages FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update own messages" ON public.outreach_messages FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admins can manage messages" ON public.outreach_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Modify Email Replies to Inbound Replies
ALTER TABLE public.email_replies RENAME TO inbound_replies;
ALTER TABLE public.inbound_replies RENAME COLUMN outreach_email_id TO outreach_message_id;
ALTER TABLE public.inbound_replies 
RENAME COLUMN from_email TO from_identifier;
ALTER TABLE public.inbound_replies 
ADD COLUMN IF NOT EXISTS channel TEXT CHECK (channel IN ('email', 'linkedin', 'call', 'other')) DEFAULT 'email';

ALTER TABLE public.inbound_replies DROP CONSTRAINT IF EXISTS email_replies_intent_check;
ALTER TABLE public.inbound_replies ADD CONSTRAINT inbound_replies_intent_check CHECK (intent IN ('interested', 'not_interested', 'question', 'call_request', 'meeting_request', 'out_of_office', 'referral', 'other'));

DROP POLICY IF EXISTS "Users can view own replies" ON public.inbound_replies;
DROP POLICY IF EXISTS "Users can update own replies" ON public.inbound_replies;
DROP POLICY IF EXISTS "Admins can manage replies" ON public.inbound_replies;

CREATE POLICY "Users can view own replies" ON public.inbound_replies FOR SELECT TO authenticated
  USING (lead_id IN (SELECT id FROM public.leads WHERE company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Users can update own replies" ON public.inbound_replies FOR UPDATE TO authenticated
  USING (lead_id IN (SELECT id FROM public.leads WHERE company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Admins can manage replies" ON public.inbound_replies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Modify Calls
ALTER TABLE public.calls 
ADD COLUMN IF NOT EXISTS sequence_step_id UUID REFERENCES public.sequence_steps(id) ON DELETE SET NULL;

ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS calls_call_type_check;
ALTER TABLE public.calls ADD CONSTRAINT calls_call_type_check CHECK (call_type IN ('outbound_ai', 'outbound_manual', 'inbound', 'scheduled'));

-- 8. New Table: Proposals
CREATE TABLE public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    template_type TEXT CHECK (template_type IN ('standard', 'premium', 'international')),
    sections JSONB,
    pdf_url TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    valid_until DATE,
    deal_value DECIMAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. New Table: Deals
CREATE TABLE public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
    deal_name TEXT NOT NULL,
    status TEXT DEFAULT 'qualifying' CHECK (status IN ('qualifying', 'proposal_sent', 'negotiating', 'verbal_yes', 'contract_sent', 'won', 'lost', 'stalled')),
    annual_value DECIMAL,
    monthly_value DECIMAL,
    one_time_value DECIMAL,
    margin_estimate DECIMAL,
    won_at TIMESTAMPTZ,
    lost_at TIMESTAMPTZ,
    lost_reason TEXT,
    contract_start DATE,
    contract_end DATE,
    renewal_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. New Table: Weekly Reports
CREATE TABLE public.weekly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    week_start DATE,
    week_end DATE,
    data JSONB,
    ai_summary TEXT,
    ai_recommendations TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. New Table: Data Sources
CREATE TABLE public.data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    source_type TEXT CHECK (source_type IN ('apollo', 'hunter', 'linkedin_sales_nav', 'sabi', 'informa', 'chamber_of_commerce', 'google_places', 'serp')),
    api_key TEXT,
    is_active BOOLEAN DEFAULT true,
    config JSONB,
    monthly_budget_cap DECIMAL,
    current_month_spend DECIMAL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. New Table: Chat Messages
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    context TEXT CHECK (context IN ('onboarding', 'campaign_setup', 'sequence_design', 'outreach_review', 'reply_management', 'call_review', 'proposal_review', 'deal_review', 'strategy', 'dashboard', 'settings', 'general')),
    actions_taken JSONB,
    ai_model_used TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Update AI Config constraint
ALTER TABLE public.ai_config DROP CONSTRAINT IF EXISTS ai_config_purpose_check;
ALTER TABLE public.ai_config ADD CONSTRAINT ai_config_purpose_check CHECK (purpose IN ('chat', 'research', 'email_writing', 'linkedin_writing', 'scoring', 'calls', 'proposals', 'strategy', 'general'));

-- Enable RLS and setup Tracking/Triggers
CREATE TRIGGER update_sequence_templates_updated_at BEFORE UPDATE ON public.sequence_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON public.data_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sequence_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sequence_templates" ON public.sequence_templates FOR ALL TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can manage own sequence_steps" ON public.sequence_steps FOR ALL TO authenticated USING (template_id IN (SELECT id FROM public.sequence_templates WHERE company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Users can manage own proposals" ON public.proposals FOR ALL TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can manage own deals" ON public.deals FOR ALL TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can read own weekly_reports" ON public.weekly_reports FOR SELECT TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can read own data_sources & global" ON public.data_sources FOR SELECT TO authenticated USING (company_id IS NULL OR company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update own data_sources" ON public.data_sources FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can manage own chat_messages" ON public.chat_messages FOR ALL TO authenticated USING (profile_id = auth.uid());
