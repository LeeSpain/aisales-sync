
-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  context TEXT DEFAULT 'general' CHECK (context IN ('onboarding', 'campaign_setup', 'outreach_review', 'reply_management', 'call_review', 'dashboard', 'settings', 'general')),
  actions_taken JSONB,
  ai_model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own messages
CREATE POLICY "Users can view own messages" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
-- Admins can view all
CREATE POLICY "Admins can view all messages" ON public.chat_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Index for fast lookups
CREATE INDEX idx_chat_messages_profile_context ON public.chat_messages (profile_id, context, created_at DESC);
