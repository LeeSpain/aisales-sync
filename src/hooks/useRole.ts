import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useRole = () => {
    const { user } = useAuth();

    const { data: roles, isLoading } = useQuery({
        queryKey: ["user-roles", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
            return data || [];
        },
        enabled: !!user,
    });

    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;

    return { roles, isAdmin, isLoading };
};
