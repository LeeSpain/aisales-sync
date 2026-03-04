import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Users, Target, DollarSign, Activity, Building2, Settings, Mail, CreditCard, Clock, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

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

  const { data: allCampaigns } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("id, status");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: allLeads } = useQuery({
    queryKey: ["admin-leads-count"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("id");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: allSubscriptions } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("plan, status, monthly_amount");
      return data || [];
    },
    enabled: isAdmin,
  });

  const activeCampaigns = allCampaigns?.length || 0;
  const totalLeads = allLeads?.length || 0;
  const mrr = allSubscriptions
    ?.filter((s) => s.status === "active" || s.status === "trial")
    .reduce((sum, s) => sum + (s.monthly_amount || 0), 0) || 0;

  const revenueByPlan = (() => {
    if (!allSubscriptions?.length) return [];
    const planMap: Record<string, { count: number; revenue: number }> = {};
    allSubscriptions.forEach((s) => {
      const plan = s.plan || "No Plan";
      if (!planMap[plan]) planMap[plan] = { count: 0, revenue: 0 };
      planMap[plan].count += 1;
      planMap[plan].revenue += s.monthly_amount || 0;
    });
    return Object.entries(planMap).map(([plan, data]) => ({
      plan: plan.charAt(0).toUpperCase() + plan.slice(1),
      clients: data.count,
      revenue: data.revenue,
    }));
  })();

  const cards = [
    { label: "Total Clients", value: allCompanies?.length || 0, icon: Users, color: "text-primary", bg: "bg-primary/15", path: "/admin/clients" },
    { label: "Active Campaigns", value: activeCampaigns, icon: Target, color: "text-accent", bg: "bg-accent/15", path: "/admin/clients" },
    { label: "Revenue (MRR)", value: `\u20AC${mrr.toLocaleString()}`, icon: DollarSign, color: "text-success", bg: "bg-success/15", path: "/admin/billing" },
    { label: "Total Leads", value: totalLeads, icon: Activity, color: "text-warning", bg: "bg-warning/15", path: "/admin/clients" },
  ];

  const navItems = [
    { label: "Clients", path: "/admin/clients", icon: Building2 },
    { label: "AI Config", path: "/admin/ai-config", icon: Zap },
    { label: "Email Config", path: "/admin/email-config", icon: Mail },
    { label: "Billing", path: "/admin/billing", icon: CreditCard },
    { label: "Settings", path: "/admin/settings", icon: Settings },
    { label: "Activity Log", path: "/admin/activity", icon: Clock },
  ];

  const chartColors = [
    "hsl(239 84% 67%)",
    "hsl(187 92% 69%)",
    "hsl(160 84% 39%)",
    "hsl(38 92% 50%)",
    "hsl(234 89% 74%)",
  ];

  const planColorMap: Record<string, string> = {
    starter: "text-primary bg-primary/10",
    growth: "text-accent bg-accent/10",
    pro: "text-success bg-success/10",
    enterprise: "text-warning bg-warning/10",
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-lg">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">
              <span className="gradient-text">Super Admin</span>
            </h1>
            <p className="text-sm text-muted-foreground">Platform overview and management</p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {cards.map((card) => (
          <div
            key={card.label}
            onClick={() => navigate(card.path)}
            className="card-glow rounded-xl p-5 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className={cn("icon-bg rounded-xl", card.bg)}>
                <card.icon className={cn("h-5 w-5", card.color)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold mt-0.5">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className="glass-card rounded-xl px-4 py-3 text-sm font-medium hover:bg-white/5 transition-all flex flex-col items-center gap-2 group"
          >
            <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Content Grid: Chart + Client List */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Revenue by Plan Chart */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-semibold mb-4 section-header-line">Revenue by Plan</h3>
          {revenueByPlan.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByPlan} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 14% 18%)" />
                  <XAxis
                    dataKey="plan"
                    tick={{ fill: "hsl(240 10% 60%)", fontSize: 12 }}
                    axisLine={{ stroke: "hsl(240 14% 18%)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(240 10% 60%)", fontSize: 12 }}
                    axisLine={{ stroke: "hsl(240 14% 18%)" }}
                    tickLine={false}
                    tickFormatter={(v) => `\u20AC${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(240 17% 8%)",
                      border: "1px solid hsl(240 14% 18%)",
                      borderRadius: "0.75rem",
                      color: "hsl(240 10% 96%)",
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`\u20AC${value.toLocaleString()}`, "Revenue"]}
                  />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {revenueByPlan.map((entry, index) => (
                      <Cell key={entry.plan} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 text-center">
              <DollarSign className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No subscription data yet</p>
            </div>
          )}
        </div>

        {/* Client List */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
            <h3 className="font-semibold section-header-line">All Clients</h3>
            <span className="text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">{allCompanies?.length || 0}</span>
          </div>
          {allCompanies && allCompanies.length > 0 ? (
            <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
              {allCompanies.map((company) => {
                const planClasses = planColorMap[company.subscription_plan?.toLowerCase() || ""] || "text-muted-foreground bg-muted/50";
                return (
                  <div
                    key={company.id}
                    className="flex items-center justify-between px-6 py-3 hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/clients/${company.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary uppercase">
                        {company.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{company.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {company.industry || "No industry"}{company.status ? ` \u00B7 ${company.status}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-medium capitalize", planClasses)}>
                      {company.subscription_plan || "No plan"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">No clients yet</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
