import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Zap, UserCheck, MailOpen, TrendingUp, PhoneCall, Users, Target, CalendarCheck, FileText, Handshake } from "lucide-react";

const stats = [
  { label: "Leads Found", key: "leads", icon: UserCheck, color: "text-primary" },
  { label: "Qualified", key: "qualified", icon: Target, color: "text-primary" },
  { label: "Messages Sent", key: "messages", icon: MailOpen, color: "text-accent" },
  { label: "Replies", key: "replies", icon: TrendingUp, color: "text-success" },
  { label: "Meetings", key: "meetings", icon: CalendarCheck, color: "text-warning" },
  { label: "Proposals", key: "proposals", icon: FileText, color: "text-accent" },
  { label: "Deals Won", key: "deals", icon: Handshake, color: "text-success" },
  { label: "Calls Made", key: "calls", icon: PhoneCall, color: "text-warning" },
];

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

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

  const totals = {
    leads: campaigns?.reduce((s, c) => s + (c.leads_found || 0), 0) || 0,
    qualified: campaigns?.reduce((s, c) => s + (c.leads_qualified || 0), 0) || 0,
    messages: campaigns?.reduce((s, c) => s + (c.emails_sent || 0), 0) || 0,
    replies: campaigns?.reduce((s, c) => s + (c.replies_received || 0), 0) || 0,
    meetings: campaigns?.reduce((s, c) => s + (c.meetings_booked || 0), 0) || 0,
    proposals: campaigns?.reduce((s, c) => s + (c.proposals_sent || 0), 0) || 0,
    deals: campaigns?.reduce((s, c) => s + (c.deals_won || 0), 0) || 0,
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

  return (
    <div className="p-8">
      <h1 className="mb-2 text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome back{user?.email ? `, ${user.email}` : ""}
      </p>

      {/* Stats */}
      <div className="mt-8 grid gap-4 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon className={cn("h-4 w-4", stat.color)} />
            </div>
            <p className="mt-2 text-2xl font-bold">{totals[stat.key as keyof typeof totals]}</p>
          </div>
        ))}
      </div>

      {/* AI Briefing */}
      <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold">AI Briefing</p>
            <p className="text-xs text-muted-foreground">Updated just now</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {campaigns && campaigns.length > 0
            ? `You have ${campaigns.length} campaign${campaigns.length > 1 ? "s" : ""} running with ${totals.leads} leads found. ${totals.replies > 0 ? `${totals.replies} replies need attention.` : "Start outreach to begin receiving replies."}`
            : "Your AI sales team is ready. Create your first campaign to start finding clients and building your pipeline."}
        </p>
        <div className="mt-4 flex gap-2">
          <Button size="sm" className="gradient-primary border-0 text-white hover:opacity-90" onClick={() => navigate("/campaigns")}>
            {campaigns && campaigns.length > 0 ? "View Campaigns" : "Create Campaign"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/leads")}>
            View Leads
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/pipeline")}>
            View Pipeline
          </Button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Top Leads */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Top Leads</h3>
            <button onClick={() => navigate("/leads")} className="text-xs text-primary hover:underline">View all</button>
          </div>
          {recentLeads && recentLeads.length > 0 ? (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {lead.score?.toFixed(1) || "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.business_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{lead.industry} • {lead.city}</p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", statusColor[lead.status] || "text-muted-foreground bg-muted")}>
                    {lead.status}
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
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Recent Activity</h3>
          {recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm">{item.description || item.action}</p>
                    <p className="text-xs text-muted-foreground">
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
