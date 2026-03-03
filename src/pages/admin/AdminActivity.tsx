import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

const AdminActivity = () => {
  const { user } = useAuth();

  const { data: roles } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const isAdmin = roles?.some((r) => r.role === "admin");
  if (roles && !isAdmin) return <Navigate to="/dashboard" replace />;

  const { data: activity } = useQuery({
    queryKey: ["admin-activity"],
    queryFn: async () => {
      const { data } = await supabase.from("activity_log").select("*, companies(name)").order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
    enabled: isAdmin,
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Activity Log</h1>
      <p className="text-muted-foreground mb-8">Global platform activity across all clients</p>

      <div className="rounded-xl border border-border bg-card">
        {activity && activity.length > 0 ? (
          <div className="divide-y divide-border">
            {activity.map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-6 py-3">
                <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="flex-1">
                  <p className="text-sm">{item.description || item.action}</p>
                  <p className="text-xs text-muted-foreground">{(item as any).companies?.name || "System"} • {new Date(item.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">No activity recorded yet</div>
        )}
      </div>
    </div>
  );
};

export default AdminActivity;
