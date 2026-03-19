import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Zap, UserCheck, MailOpen, TrendingUp, PhoneCall, Users, Target, CalendarCheck, FileText, Handshake, BarChart3, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { statusChartColors } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const stats = [
  { label: "Leads Found", key: "leads", icon: UserCheck, color: "text-primary", bg: "bg-primary/15" },
  { label: "Qualified", key: "qualified", icon: Target, color: "text-primary", bg: "bg-primary/15" },
  { label: "Messages Sent", key: "messages", icon: MailOpen, color: "text-accent", bg: "bg-accent/15" },
  { label: "Replies", key: "replies", icon: TrendingUp, color: "text-success", bg: "bg-success/15" },
  { label: "Meetings", key: "meetings", icon: CalendarCheck, color: "text-warning", bg: "bg-warning/15" },
  { label: "Proposals", key: "proposals", icon: FileText, color: "text-accent", bg: "bg-accent/15" },
  { label: "Deals Won", key: "deals", icon: Handshake, color: "text-success", bg: "bg-success/15" },
  { label: "Calls Made", key: "calls", icon: PhoneCall, color: "text-warning", bg: "bg-warning/15" },
];

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      // If company_id is null, try to find and link an existing company
      if (data && !data.company_id) {
        const { data: existing } = await supabase
          .from("companies").select("id").eq("owner_id", user!.id).limit(1).maybeSingle();
        if (existing) {
          await supabase.from("profiles").update({ company_id: existing.id }).eq("id", user!.id);
          data.company_id = existing.id;
        }
      }
      return data;
    },
    enabled: !!user,
  });

  // Company profile for completion banner
  const { data: company } = useQuery({
    queryKey: ["company-profile-check", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("name, description, services, selling_points, target_markets")
        .eq("id", profile!.company_id!)
        .single();
      return data;
    },
    enabled: !!profile?.company_id,
  });

  const profileFields = [
    company?.name,
    company?.description,
    Array.isArray(company?.services) && (company?.services as string[]).length > 0,
    Array.isArray(company?.selling_points) && (company?.selling_points as string[]).length > 0,
    Array.isArray(company?.target_markets) && (company?.target_markets as string[]).length > 0,
  ];
  const completedFields = profileFields.filter(Boolean).length;
  const completionPct = Math.round((completedFields / 5) * 100);
  const isProfileComplete = completedFields === 5;

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-stats", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("*").eq("company_id", profile!.company_id!);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: recentLeads } = useQuery({
    queryKey: ["recent-leads", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("*").eq("company_id", profile!.company_id!).order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: recentActivity } = useQuery({
    queryKey: ["recent-activity", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from("activity_log").select("*").eq("company_id", profile!.company_id!).order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: leadStatusCounts } = useQuery({
    queryKey: ["lead-status-counts", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("status")
        .eq("company_id", profile!.company_id!);
      const meetingBooked = data?.filter((l) => l.status === "meeting_booked").length || 0;
      const proposalSent = data?.filter((l) => l.status === "proposal_sent").length || 0;
      const converted = data?.filter((l) => l.status === "converted").length || 0;
      return { meetingBooked, proposalSent, converted };
    },
    enabled: !!profile?.company_id,
  });

  const { data: allLeadStatuses } = useQuery({
    queryKey: ["lead-all-statuses", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("status")
        .eq("company_id", profile!.company_id!);
      const counts: Record<string, number> = {};
      data?.forEach((l) => {
        const s = l.status || "unknown";
        counts[s] = (counts[s] || 0) + 1;
      });
      return counts;
    },
    enabled: !!profile?.company_id,
  });

  const totals = {
    leads: campaigns?.reduce((s, c) => s + (c.leads_found || 0), 0) || 0,
    qualified: campaigns?.reduce((s, c) => s + (c.leads_qualified || 0), 0) || 0,
    messages: campaigns?.reduce((s, c) => s + (c.emails_sent || 0), 0) || 0,
    replies: campaigns?.reduce((s, c) => s + (c.replies_received || 0), 0) || 0,
    meetings: leadStatusCounts?.meetingBooked || 0,
    proposals: leadStatusCounts?.proposalSent || 0,
    deals: leadStatusCounts?.converted || 0,
    calls: campaigns?.reduce((s, c) => s + (c.calls_made || 0), 0) || 0,
  };

  const statusColor: Record<string, string> = {
    discovered: "text-muted-foreground bg-muted",
    researched: "text-muted-foreground bg-muted",
    scored: "text-primary-light bg-primary/10",
    qualified: "text-success bg-success/10",
    sequence_active: "text-accent bg-accent/10",
    contacted: "text-primary bg-primary/10",
    replied: "text-accent bg-accent/10",
    in_conversation: "text-accent bg-accent/10",
    meeting_booked: "text-warning bg-warning/10",
    proposal_sent: "text-primary bg-primary/10",
    negotiating: "text-warning bg-warning/10",
    converted: "text-success bg-success/10",
    rejected: "text-destructive bg-destructive/10",
    unresponsive: "text-muted-foreground bg-muted",
  };

  const pipelineChartData = allLeadStatuses
    ? Object.entries(allLeadStatuses).map(([status, count]) => ({
        status: status.replace(/_/g, " "),
        rawStatus: status,
        count,
      }))
    : [];

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">
          Welcome back
          {profile?.full_name ? (
            <span className="gradient-text">{`, ${profile.full_name}`}</span>
          ) : user?.email ? (
            <span className="text-muted-foreground text-xl font-normal ml-2">({user.email})</span>
          ) : null}
          {company && isProfileComplete && (
            <span className="ml-2 text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-medium align-middle">
              Profile complete
            </span>
          )}
        </h1>
        <p className="mt-1 text-muted-foreground">Here's your sales pipeline at a glance</p>
      </div>

      {/* Company profile completion banner */}
      {!isProfileComplete && (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-sm text-amber-400">
                {company ? `Complete your company profile (${completionPct}%)` : "Set up your company profile"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your AI needs to know about your business to find the right leads and write personalised emails.
              </p>
              {company && (
                <div className="mt-2 h-1.5 w-48 rounded-full bg-amber-500/20">
                  <div
                    className="h-1.5 rounded-full bg-amber-400 transition-all"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              )}
            </div>
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white border-0"
            onClick={() => navigate("/settings")}
          >
            {company ? "Complete Profile" : "Set Up Profile"}
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card-glow rounded-xl p-5 group">
            <div className="flex items-center gap-3">
              <div className={cn("icon-bg rounded-xl", stat.bg)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                <p className="text-2xl font-bold mt-0.5">{totals[stat.key as keyof typeof totals]}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Briefing */}
      <div className="mt-8 glass-card rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-lg">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-base">AI Briefing</p>
            <p className="text-xs text-muted-foreground">Updated just now</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {campaigns && campaigns.length > 0
            ? `You have ${campaigns.length} campaign${campaigns.length > 1 ? "s" : ""} running with ${totals.leads} leads found. ${totals.replies > 0 ? `${totals.replies} replies need attention.` : "Start outreach to begin receiving replies."}`
            : "Your AI sales team is ready. Create your first campaign to start finding clients and building your pipeline."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" className="gradient-primary border-0 text-white hover:opacity-90" onClick={() => navigate("/campaigns")}>
            {campaigns && campaigns.length > 0 ? "View Campaigns" : "Create Campaign"}
          </Button>
          <Button size="sm" variant="outline" className="border-border/50 hover:bg-muted/50" onClick={() => navigate("/leads")}>
            View Leads
          </Button>
          <Button size="sm" variant="outline" className="border-border/50 hover:bg-muted/50" onClick={() => navigate("/pipeline")}>
            View Pipeline
          </Button>
        </div>
      </div>

      {/* Pipeline Chart */}
      <div className="mt-8 glass-card rounded-xl p-6">
        <h3 className="font-semibold mb-4 section-header-line">Lead Pipeline</h3>
        {pipelineChartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 14% 18%)" />
                <XAxis
                  dataKey="status"
                  tick={{ fill: "hsl(240 10% 60%)", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(240 14% 18%)" }}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fill: "hsl(240 10% 60%)", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(240 14% 18%)" }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(240 17% 8%)",
                    border: "1px solid hsl(240 14% 18%)",
                    borderRadius: "0.75rem",
                    color: "hsl(240 10% 96%)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {pipelineChartData.map((entry) => (
                    <Cell key={entry.rawStatus} fill={statusChartColors[entry.rawStatus] || "hsl(239 84% 67%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center py-12 text-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No lead data yet</p>
          </div>
        )}
      </div>

      {/* Content Grid */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Top Leads */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold section-header-line">Top Leads</h3>
            <button onClick={() => navigate("/leads")} className="text-xs text-primary hover:text-primary-light transition-colors">View all &rarr;</button>
          </div>
          {recentLeads && recentLeads.length > 0 ? (
            <div className="space-y-2">
              {recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 rounded-lg p-3 hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-border/50"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                    {lead.score?.toFixed(1) || "--"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.business_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{lead.industry}{lead.city ? ` \u00B7 ${lead.city}` : ""}</p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-medium capitalize whitespace-nowrap", statusColor[lead.status] || "text-muted-foreground bg-muted")}>
                    {lead.status?.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No leads yet</p>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-semibold mb-4 section-header-line">Recent Activity</h3>
          {recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-0">
              {recentActivity.map((item, index) => (
                <div key={item.id} className="flex gap-3 group">
                  <div className="flex flex-col items-center">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full gradient-primary" />
                    {index < recentActivity.length - 1 && (
                      <div className="w-px flex-1 bg-border/50 mt-1" />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm">{item.description || item.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No activity yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
