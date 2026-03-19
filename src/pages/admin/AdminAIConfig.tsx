import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const AdminAIConfig = () => {
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

  const { data: configs } = useQuery({
    queryKey: ["ai-configs"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_config").select("*").order("created_at");
      return data || [];
    },
    enabled: isAdmin,
  });

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-xl md:text-2xl font-bold mb-2">AI Configuration</h1>
      <p className="text-muted-foreground mb-8">Manage AI providers, models, and budgets</p>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 mb-8">
        <p className="text-sm">
          <strong>Lovable AI Gateway</strong> is pre-configured and ready to use. The gateway provides access to Google Gemini and OpenAI models.
          Additional providers can be configured below for specific purposes.
        </p>
      </div>

      {configs && configs.length > 0 ? (
        <div className="space-y-4">
          {configs.map((config) => (
            <div key={config.id} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold capitalize">{config.provider} — {config.model}</p>
                  <p className="text-xs text-muted-foreground capitalize">Purpose: {config.purpose}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${config.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  {config.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Temperature:</span> {config.temperature}</div>
                <div><span className="text-muted-foreground">Max Tokens:</span> {config.max_tokens}</div>
                <div><span className="text-muted-foreground">Budget:</span> €{config.monthly_budget_cap || "—"} (Spent: €{config.current_month_spend})</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">Using Lovable AI Gateway (default). Add custom providers for specific purposes.</p>
          <Button className="mt-4 gradient-primary border-0 text-white" onClick={() => toast({ title: "Coming soon", description: "Custom provider configuration will be added in the next update." })}>
            Add Provider
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminAIConfig;
