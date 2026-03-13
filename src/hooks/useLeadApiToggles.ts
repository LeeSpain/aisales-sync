import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadApiDefinition {
  purpose: string;      // maps to provider_configs.provider_name
  label: string;
  description: string;
  category: "Lead Discovery" | "Web Scraping";
  docsUrl?: string;
}

export const LEAD_APIS: LeadApiDefinition[] = [
  { purpose: "serper", label: "Serper API", description: "Google Search & Places for real lead discovery/enrichment", category: "Lead Discovery", docsUrl: "https://serper.dev" },
  { purpose: "google_places", label: "Google Places", description: "Direct Google Places API integration (future)", category: "Lead Discovery", docsUrl: "https://console.cloud.google.com/apis/credentials" },
  { purpose: "apollo", label: "Apollo.io", description: "B2B prospect database & enrichment", category: "Lead Discovery", docsUrl: "https://apollo.io/settings/api" },
  { purpose: "linkedin_session", label: "LinkedIn", description: "LinkedIn search & sequences via session cookie", category: "Lead Discovery", docsUrl: "https://linkedin.com" },
  { purpose: "playwright", label: "Playwright", description: "Headless browser for JavaScript-heavy websites (coming soon)", category: "Web Scraping" },
  { purpose: "crawl4ai", label: "Crawl4AI", description: "AI-powered content extraction (coming soon)", category: "Web Scraping" },
  { purpose: "scrapy", label: "Scrapy", description: "Deep crawl and structured data extraction (coming soon)", category: "Web Scraping" },
];

const QUERY_KEY = ["provider-configs"];

export function useLeadApiToggles() {
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await supabase
        .from("provider_configs")
        .select("*")
        .in("provider_name", LEAD_APIS.map(api => api.purpose))
        .order("priority");
      return data || [];
    },
    staleTime: 15_000,
  });

  const isApiEnabled = (purpose: string) => {
    const config = configs.find((c) => c.provider_name === purpose);
    return config?.is_enabled ?? false;
  };

  const getApiConfig = (purpose: string) => {
    return configs.find((c) => c.provider_name === purpose);
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ purpose, enabled }: { purpose: string; enabled: boolean }) => {
      const existing = configs.find((c) => c.provider_name === purpose);

      if (existing) {
        await supabase
          .from("provider_configs")
          .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("provider_configs").insert({
          provider_name: purpose,
          is_enabled: enabled,
          priority: 0,
          company_id: null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ purpose, updates }: { purpose: string; updates: Record<string, unknown> }) => {
      const existing = configs.find((c) => c.provider_name === purpose);
      if (existing) {
        await supabase
          .from("provider_configs")
          .update({ ...updates, updated_at: new Date().toISOString() })
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
