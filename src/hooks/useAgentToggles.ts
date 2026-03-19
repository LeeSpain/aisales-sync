import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgentDefinition {
  purpose: string;
  label: string;
  description: string;
  defaultModel: string;
}

export const AGENTS: AgentDefinition[] = [
  { purpose: "chat", label: "AI Chat Assistant", description: "Conversational AI across all contexts (onboarding, dashboard, etc.)", defaultModel: "google/gemini-3-flash-preview" },
  { purpose: "email_writing", label: "Outreach Writer", description: "Generates personalised sales emails for lead outreach", defaultModel: "google/gemini-3-flash-preview" },
  { purpose: "scoring", label: "Lead Scorer", description: "Scores leads 1.0–5.0 against company profile", defaultModel: "google/gemini-3-flash-preview" },
  { purpose: "research", label: "Lead Discovery", description: "Finds new leads via AI-powered research", defaultModel: "google/gemini-3-flash-preview" },
  { purpose: "linkedin_writing", label: "LinkedIn Writer", description: "Generates LinkedIn connection requests and messages", defaultModel: "google/gemini-3-flash-preview" },
  { purpose: "calls", label: "AI Caller", description: "AI-driven voice calls via Twilio integration", defaultModel: "google/gemini-3-flash-preview" },
  { purpose: "proposals", label: "Proposal Generator", description: "Creates and sends tailored proposals to qualified leads", defaultModel: "google/gemini-3-flash-preview" },
  { purpose: "strategy", label: "Strategy Analyst", description: "Analyses sales strategy and provides recommendations", defaultModel: "google/gemini-3-flash-preview" },
];

const QUERY_KEY = ["agent-configs"];

export function useAgentToggles() {
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_config")
        .select("*")
        .not("purpose", "in", '("api_key_store","system_setting")')
        .order("created_at");
      return data || [];
    },
    staleTime: 15_000,
  });

  const isAgentActive = (purpose: string) => {
    const config = configs.find((c) => c.purpose === purpose);
    return config?.is_active ?? true; // default active if no record
  };

  const getAgentConfig = (purpose: string) => {
    return configs.find((c) => c.purpose === purpose);
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ purpose, enabled }: { purpose: string; enabled: boolean }) => {
      const existing = configs.find((c) => c.purpose === purpose);
      const agent = AGENTS.find((a) => a.purpose === purpose);

      if (existing) {
        await supabase
          .from("ai_config")
          .update({ is_active: enabled })
          .eq("id", existing.id);
      } else {
        await supabase.from("ai_config").insert({
          provider: "lovable_gateway",
          purpose,
          model: agent?.defaultModel || "google/gemini-3-flash-preview",
          is_active: enabled,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ purpose, updates }: { purpose: string; updates: Record<string, any> }) => {
      const existing = configs.find((c) => c.purpose === purpose);
      const agent = AGENTS.find((a) => a.purpose === purpose);

      if (existing) {
        await supabase
          .from("ai_config")
          .update(updates)
          .eq("id", existing.id);
      } else {
        await supabase.from("ai_config").insert({
          provider: "lovable_gateway",
          purpose,
          model: agent?.defaultModel || "google/gemini-3-flash-preview",
          is_active: true,
          ...updates,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return {
    configs,
    isLoading,
    isAgentActive,
    getAgentConfig,
    toggleAgent: toggleMutation.mutate,
    isToggling: toggleMutation.isPending,
    updateConfig: updateConfigMutation.mutate,
    isUpdating: updateConfigMutation.isPending,
  };
}
