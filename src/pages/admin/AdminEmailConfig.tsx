import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";

const AdminEmailConfig = () => {
  const { user } = useAuth();
  const { toast } = useToast();

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

  const { data: emailConfigs } = useQuery({
    queryKey: ["admin-email-configs"],
    queryFn: async () => {
      const { data } = await supabase.from("email_config").select("*, companies(name)");
      return data || [];
    },
    enabled: isAdmin,
  });

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center gap-3 mb-2">
        <Mail className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Email Configuration</h1>
      </div>
      <p className="text-muted-foreground mb-8">Manage email sending domains, warmup status, and limits per client</p>

      {emailConfigs && emailConfigs.length > 0 ? (
        <div className="space-y-4">
          {emailConfigs.map((config: any) => (
            <div key={config.id} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold">{config.sending_email || "Not configured"}</p>
                  <p className="text-xs text-muted-foreground">
                    {config.companies?.name || "Unknown company"} • {config.provider || "No provider"}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  config.warmup_status === "ready" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                }`}>
                  {config.warmup_status || "warming"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Domain:</span> {config.sending_domain || "—"}</div>
                <div><span className="text-muted-foreground">Daily Limit:</span> {config.daily_send_limit}</div>
                <div><span className="text-muted-foreground">Sender:</span> {config.sender_name || "—"}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Mail className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-2">No email configurations yet</p>
          <p className="text-xs text-muted-foreground">Email configs are created per client. Add a SendGrid API key in Admin Settings first.</p>
        </div>
      )}
    </div>
  );
};

export default AdminEmailConfig;
