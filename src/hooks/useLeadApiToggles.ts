import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadApiDefinition {
  purpose: string;
  label: string;
  description: string;
  category: "Lead Discovery";
  docsUrl?: string;
}

export const LEAD_APIS: LeadApiDefinition[] = [
  { purpose: "serper_api", label: "Serper API", description: "Google Search & Places for real lead discovery/enrichment", category: "Lead Discovery", docsUrl: "https://serpapi.com/dashboard" },
  { purpose: "google_places_api", label: "Google Places", description: "Direct Google Places API integration (future)", category: "Lead Discovery", docsUrl: "https://console.cloud.google.com/apis/credentials" },
  { purpose: "apollo_api", label: "Apollo.io", description: "B2B prospect database & enrichment", category: "Lead Discovery", docsUrl: "https://apollo.io/settings/api" },
  { purpose: "linkedin_api", label: "LinkedIn", description: "LinkedIn search & sequences via session cookie", category: "Lead Discovery", docsUrl: "https://linkedin.com" },
];

const QUERY_KEY = ["lead-api-configs"];

export function useLeadApiToggles() {
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_config")
        .select("*")
        .in("purpose", LEAD_APIS.map(api => api.purpose))
        .order("created_at");
      return data || [];
    },
    staleTime: 15_000,
  });

  const isApiEnabled = (purpose: string) => {
    const config = configs.find((c) => c.purpose === purpose);
    return config?.is_active ?? true; // default enabled if no record
  };

  const getApiConfig = (purpose: string) => {
    return configs.find((c) => c.purpose === purpose);
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ purpose, enabled }: { purpose: string; enabled: boolean }) => {
      const existing = configs.find((c) => c.purpose === purpose);
      const apiDef = LEAD_APIS.find((a) => a.purpose === purpose);

      if (existing) {
        await supabase
          .from("ai_config")
          .update({ is_active: enabled })
          .eq("id", existing.id);
      } else {
        await supabase.from("ai_config").insert({
          provider: "system_api_toggle",
          purpose,
          is_active: enabled,
          metadata: { label: apiDef?.label },
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
      if (existing) {
        await supabase
          .from("ai_config")
          .update(updates)
          .eq("id", existing.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return {
    configs,
    isLoading,
    isApiEnabled,
    getApiConfig,
    toggleApi: toggleMutation.mutate,
    isToggling: toggleMutation.isPending,
    updateConfig: updateConfigMutation.mutate,
    isUpdating: updateConfigMutation.isPending,
    LEAD_APIS,
  };
}

