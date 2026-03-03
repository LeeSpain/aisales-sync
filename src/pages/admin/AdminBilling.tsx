import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { CreditCard, DollarSign } from "lucide-react";

const AdminBilling = () => {
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

  const { data: subscriptions } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("*, companies(name)");
      return data || [];
    },
    enabled: isAdmin,
  });

  const totalMRR = subscriptions?.reduce((sum, s: any) => sum + (s.monthly_amount || 0), 0) || 0;
  const activeCount = subscriptions?.filter((s) => s.status === "active").length || 0;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Billing Overview</h1>
      <p className="text-muted-foreground mb-8">Platform revenue and subscription management</p>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total MRR</span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold">€{totalMRR.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Active Subscriptions</span>
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Subscriptions</span>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold">{subscriptions?.length || 0}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h3 className="font-semibold">All Subscriptions</h3>
        </div>
        {subscriptions && subscriptions.length > 0 ? (
          <div className="divide-y divide-border">
            {subscriptions.map((sub: any) => (
              <div key={sub.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium text-sm">{sub.companies?.name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{sub.plan || "—"} • {sub.status}</p>
                </div>
                <span className="font-semibold">€{sub.monthly_amount || 0}/mo</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">No subscriptions yet</div>
        )}
      </div>
    </div>
  );
};

export default AdminBilling;
