import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const QUERY_KEY = ["system-dead-switch"];

export function useDeadSwitch() {
  const queryClient = useQueryClient();

  const { data: isKilled = false, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_config")
        .select("is_active")
        .eq("provider", "dead_switch")
        .eq("purpose", "system_setting")
        .maybeSingle();
      return data?.is_active ?? false;
    },
    staleTime: 10_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: existing } = await supabase
        .from("ai_config")
        .select("id")
        .eq("provider", "dead_switch")
        .eq("purpose", "system_setting")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("ai_config")
          .update({ is_active: enabled })
          .eq("id", existing.id);
      } else {
        await supabase.from("ai_config").insert({
          provider: "dead_switch",
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
    isKilled,
    isLoading,
    toggle: toggleMutation.mutate,
    isToggling: toggleMutation.isPending,
  };
}
