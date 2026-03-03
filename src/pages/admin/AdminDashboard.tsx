import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Users, Target, DollarSign, Activity } from "lucide-react";

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Check admin role
  const { data: roles } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const isAdmin = roles?.some((r) => r.role === "admin");

  if (roles && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const { data: allCompanies } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: allProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*");
      return data || [];
    },
    enabled: isAdmin,
  });

  const cards = [
    { label: "Total Clients", value: allCompanies?.length || 0, icon: Users, path: "/admin/clients" },
    { label: "Active Campaigns", value: "—", icon: Target, path: "/admin/clients" },
    { label: "Revenue (MRR)", value: "—", icon: DollarSign, path: "/admin/billing" },
    { label: "AI Spend (MTD)", value: "—", icon: Activity, path: "/admin/ai-config" },
  ];

  const navItems = [
    { label: "Clients", path: "/admin/clients" },
    { label: "AI Config", path: "/admin/ai-config" },
    { label: "Email Config", path: "/admin/email-config" },
    { label: "Billing", path: "/admin/billing" },
    { label: "Activity Log", path: "/admin/activity" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
      <p className="text-muted-foreground mb-8">Platform overview and management</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} onClick={() => navigate(card.path)} className="cursor-pointer rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <card.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-8">
        {navItems.map((item) => (
          <button key={item.label} onClick={() => navigate(item.path)} className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
            {item.label}
          </button>
        ))}
      </div>

      {/* Client list */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h3 className="font-semibold">All Clients ({allCompanies?.length || 0})</h3>
        </div>
        {allCompanies && allCompanies.length > 0 ? (
          <div className="divide-y divide-border">
            {allCompanies.map((company) => (
              <div key={company.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/admin/clients/${company.id}`)}>
                <div>
                  <p className="text-sm font-medium">{company.name}</p>
                  <p className="text-xs text-muted-foreground">{company.industry} • {company.status}</p>
                </div>
                <span className="text-xs text-muted-foreground capitalize">{company.subscription_plan || "No plan"}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">No clients yet</div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
