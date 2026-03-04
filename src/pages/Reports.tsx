import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import {
    BarChart3,
    TrendingUp,
    Target,
    Users2,
    Mail,
    PhoneCall,
    Handshake,
    Sparkles,
    ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const strategySuggestions = [
    {
        title: "Increase LinkedIn Touchpoints",
        description: "Data shows higher reply rates from prospects who received a LinkedIn message before an email. Consider adding a LinkedIn step to all sequences.",
        impact: "high",
        icon: TrendingUp,
    },
    {
        title: "Optimal Send Time",
        description: "Emails sent between 9:15-10:30 AM (recipient timezone) tend to have higher open rates. Adjusting send schedules could yield more replies.",
        impact: "medium",
        icon: Target,
    },
    {
        title: "Follow-Up Gaps",
        description: "Check for qualified leads that haven't been contacted recently. Timely follow-up prevents pipeline stagnation.",
        impact: "high",
        icon: ArrowUpRight,
    },
];

const Reports = () => {
    const { user } = useAuth();

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: async () => {
            const { data } = await supabase.from("profiles").select("company_id").eq("id", user!.id).single();
            return data;
        },
        enabled: !!user,
    });

    const { data: campaigns } = useQuery({
        queryKey: ["report-campaigns", profile?.company_id],
        queryFn: async () => {
            const { data } = await supabase.from("campaigns").select("*").eq("company_id", profile!.company_id!);
            return data || [];
        },
        enabled: !!profile?.company_id,
    });

    const { data: leadsCount } = useQuery({
        queryKey: ["report-leads-count", profile?.company_id],
        queryFn: async () => {
            const { count } = await supabase
                .from("leads")
                .select("id", { count: "exact", head: true })
                .eq("company_id", profile!.company_id!);
            return count || 0;
        },
        enabled: !!profile?.company_id,
    });

    const { data: convertedCount } = useQuery({
        queryKey: ["report-converted-count", profile?.company_id],
        queryFn: async () => {
            const { count } = await supabase
                .from("leads")
                .select("id", { count: "exact", head: true })
                .eq("company_id", profile!.company_id!)
                .eq("status", "converted");
            return count || 0;
        },
        enabled: !!profile?.company_id,
    });

    const { data: emailsCount } = useQuery({
        queryKey: ["report-emails-count", profile?.company_id],
        queryFn: async () => {
            const { count } = await supabase
                .from("outreach_emails")
                .select("id", { count: "exact", head: true })
                .eq("company_id", profile!.company_id!);
            return count || 0;
        },
        enabled: !!profile?.company_id,
    });

    const { data: callsCount } = useQuery({
        queryKey: ["report-calls-count", profile?.company_id],
        queryFn: async () => {
            const { count } = await supabase
                .from("calls")
                .select("id", { count: "exact", head: true })
                .eq("company_id", profile!.company_id!);
            return count || 0;
        },
        enabled: !!profile?.company_id,
    });

    const totalReplies = campaigns?.reduce((s, c) => s + (c.replies_received || 0), 0) || 0;
    const totalEmailsSent = campaigns?.reduce((s, c) => s + (c.emails_sent || 0), 0) || 0;
    const replyRate = totalEmailsSent > 0 ? ((totalReplies / totalEmailsSent) * 100).toFixed(1) : "0";

    const statCards = [
        { label: "Total Leads", value: leadsCount || 0, icon: Users2, color: "text-primary" },
        { label: "Emails Sent", value: totalEmailsSent, icon: Mail, color: "text-blue-400" },
        { label: "Replies", value: totalReplies, icon: TrendingUp, color: "text-emerald-400" },
        { label: "Reply Rate", value: `${replyRate}%`, icon: Target, color: "text-amber-400" },
        { label: "Calls Made", value: callsCount || 0, icon: PhoneCall, color: "text-cyan-400" },
        { label: "Campaigns", value: campaigns?.length || 0, icon: BarChart3, color: "text-indigo-400" },
        { label: "Deals Won", value: convertedCount || 0, icon: Handshake, color: "text-emerald-400" },
    ];

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Reports & Strategy</h1>
                    <p className="text-muted-foreground text-sm">Performance overview and strategic guidance</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
                {statCards.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.label} className="rounded-xl border border-border bg-card p-3 text-center">
                            <Icon className={cn("h-4 w-4 mx-auto mb-1", stat.color)} />
                            <p className="text-lg font-bold text-white">{stat.value}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                        </div>
                    );
                })}
            </div>

            <div className="grid lg:grid-cols-5 gap-6">
                {/* Strategy AI panel */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <h2 className="text-lg font-semibold">AI Strategy</h2>
                    </div>
                    {strategySuggestions.map((suggestion, i) => {
                        const Icon = suggestion.icon;
                        return (
                            <div
                                key={i}
                                className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors"
                            >
                                <div className="flex items-start gap-3">
                                    <div className={cn(
                                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                        suggestion.impact === "high" ? "bg-emerald-500/10" : "bg-amber-500/10",
                                    )}>
                                        <Icon className={cn(
                                            "h-4 w-4",
                                            suggestion.impact === "high" ? "text-emerald-400" : "text-amber-400",
                                        )} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-sm font-semibold text-white">{suggestion.title}</h3>
                                            <Badge variant="outline" className={cn(
                                                "text-[9px] uppercase",
                                                suggestion.impact === "high" ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"
                                            )}>
                                                {suggestion.impact}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{suggestion.description}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Campaign breakdown */}
                <div className="lg:col-span-3">
                    <h2 className="text-lg font-semibold mb-4">Campaign Performance</h2>
                    {campaigns && campaigns.length > 0 ? (
                        <div className="space-y-4">
                            {campaigns.map((campaign) => (
                                <div
                                    key={campaign.id}
                                    className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="font-semibold text-white">{campaign.name}</h3>
                                            <p className="text-xs text-muted-foreground capitalize">{campaign.status || "draft"} · {campaign.geographic_focus || "Global"}</p>
                                        </div>
                                        <Badge variant="secondary" className="text-xs capitalize">{campaign.status || "draft"}</Badge>
                                    </div>
                                    <div className="flex gap-4 text-xs text-muted-foreground">
                                        <span>{campaign.leads_found || 0} leads</span>
                                        <span>{campaign.emails_sent || 0} sent</span>
                                        <span>{campaign.replies_received || 0} replies</span>
                                        <span>{campaign.calls_made || 0} calls</span>
                                    </div>
                                    {(campaign.emails_sent || 0) > 0 && (
                                        <div className="mt-3">
                                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                                <span>Reply rate</span>
                                                <span>{((campaign.replies_received || 0) / (campaign.emails_sent || 1) * 100).toFixed(1)}%</span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-border overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-primary transition-all"
                                                    style={{ width: `${Math.min(((campaign.replies_received || 0) / (campaign.emails_sent || 1) * 100), 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-border p-12 text-center">
                            <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                            <p className="text-sm text-muted-foreground">No campaigns yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Create a campaign to start seeing performance data</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Reports;
