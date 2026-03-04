import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const QUERY_KEY = ["system-test-mode"];

export function useTestMode() {
  const queryClient = useQueryClient();

  const { data: isTestMode = false, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_config")
        .select("is_active")
        .eq("provider", "test_mode")
        .eq("purpose", "system_setting")
        .maybeSingle();
      return data?.is_active ?? false;
    },
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: existing } = await supabase
        .from("ai_config")
        .select("id")
        .eq("provider", "test_mode")
        .eq("purpose", "system_setting")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("ai_config")
          .update({ is_active: enabled })
          .eq("id", existing.id);
      } else {
        await supabase.from("ai_config").insert({
          provider: "test_mode",
          purpose: "system_setting",
          model: "System",
          is_active: enabled,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return {
    isTestMode,
    isLoading,
    toggle: toggleMutation.mutate,
    isToggling: toggleMutation.isPending,
  };
}
