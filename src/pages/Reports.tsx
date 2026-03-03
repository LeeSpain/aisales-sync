import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    Target,
    Users2,
    Mail,
    PhoneCall,
    Handshake,
    Calendar,
    Sparkles,
    BrainCircuit,
    ChevronRight,
    ArrowUpRight,
    ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
interface WeeklyReport {
    id: string;
    week_label: string;
    period: string;
    leads_found: number;
    emails_sent: number;
    replies: number;
    calls_made: number;
    proposals_sent: number;
    deals_won: number;
    revenue: number;
    highlights: string[];
}

/* ─── Demo data ─── */
const demoReports: WeeklyReport[] = [
    {
        id: "1",
        week_label: "Week 9",
        period: "Feb 26 – Mar 3",
        leads_found: 47,
        emails_sent: 124,
        replies: 18,
        calls_made: 8,
        proposals_sent: 3,
        deals_won: 1,
        revenue: 15000,
        highlights: [
            "Reply rate improved to 14.5% (+2.1%)",
            "New campaign 'Tech Startups UK' launched, 23 leads scored 8+",
            "1 deal closed: RetailPlus — £15,000 quarterly",
        ],
    },
    {
        id: "2",
        week_label: "Week 8",
        period: "Feb 19 – Feb 25",
        leads_found: 39,
        emails_sent: 98,
        replies: 12,
        calls_made: 5,
        proposals_sent: 2,
        deals_won: 0,
        revenue: 0,
        highlights: [
            "Email deliverability at 97.2%",
            "LinkedIn response rate: 8.3%",
            "2 proposals under review by prospects",
        ],
    },
    {
        id: "3",
        week_label: "Week 7",
        period: "Feb 12 – Feb 18",
        leads_found: 52,
        emails_sent: 135,
        replies: 21,
        calls_made: 11,
        proposals_sent: 4,
        deals_won: 2,
        revenue: 20500,
        highlights: [
            "Highest reply rate this quarter: 15.6%",
            "AI voice calls converted 3 to meetings",
            "2 deals closed: LocalBiz + TestDrive",
        ],
    },
];

const strategySuggestions = [
    {
        title: "Increase LinkedIn Touchpoints",
        description: "Data shows 22% higher reply rates from prospects who received a LinkedIn message before an email. Consider adding a LinkedIn step to all sequences.",
        impact: "high",
        icon: TrendingUp,
    },
    {
        title: "Optimal Send Time Detected",
        description: "Emails sent between 9:15–10:30 AM (recipient timezone) have 34% higher open rates. Adjusting send schedules could yield 8-12 more replies per week.",
        impact: "medium",
        icon: Target,
    },
    {
        title: "Follow-Up Gap Identified",
        description: "18 qualified leads haven't been contacted in 5+ days. Recommend immediate follow-up sequence to prevent pipeline stagnation.",
        impact: "high",
        icon: ArrowUpRight,
    },
];

const Reports = () => {
    const latestReport = demoReports[0];

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Reports & Strategy</h1>
                    <p className="text-muted-foreground text-sm">AI performance analysis and strategic guidance</p>
                </div>
                <Button size="sm" className="gap-1.5 gradient-primary text-white border-0">
                    <BrainCircuit className="h-3.5 w-3.5" />
                    Run Strategy Analysis
                </Button>
            </div>

            {/* Latest week stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
                {[
                    { label: "Leads", value: latestReport.leads_found, icon: Users2, color: "text-primary" },
                    { label: "Emails", value: latestReport.emails_sent, icon: Mail, color: "text-blue-400" },
                    { label: "Replies", value: latestReport.replies, icon: TrendingUp, color: "text-emerald-400" },
                    { label: "Calls", value: latestReport.calls_made, icon: PhoneCall, color: "text-amber-400" },
                    { label: "Proposals", value: latestReport.proposals_sent, icon: BarChart3, color: "text-cyan-400" },
                    { label: "Deals", value: latestReport.deals_won, icon: Handshake, color: "text-emerald-400" },
                    { label: "Revenue", value: `£${(latestReport.revenue / 1000).toFixed(0)}k`, icon: TrendingUp, color: "text-emerald-400" },
                ].map((stat) => {
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
                {/* Strategy AI panel — 2 cols */}
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

                {/* Weekly reports list — 3 cols */}
                <div className="lg:col-span-3">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-lg font-semibold">Weekly Reports</h2>
                    </div>
                    <div className="space-y-4">
                        {demoReports.map((report) => (
                            <div
                                key={report.id}
                                className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="font-semibold text-white">{report.week_label}</h3>
                                        <p className="text-xs text-muted-foreground">{report.period}</p>
                                    </div>
                                    {report.revenue > 0 && (
                                        <Badge className="bg-emerald-500/10 text-emerald-400 text-xs">
                                            +£{report.revenue.toLocaleString()}
                                        </Badge>
                                    )}
                                </div>

                                {/* Mini stats */}
                                <div className="flex gap-4 mb-3 text-xs">
                                    <span className="text-muted-foreground">{report.leads_found} leads</span>
                                    <span className="text-muted-foreground">{report.emails_sent} sent</span>
                                    <span className="text-muted-foreground">{report.replies} replies</span>
                                    <span className="text-muted-foreground">{report.calls_made} calls</span>
                                    <span className="text-muted-foreground">{report.deals_won} won</span>
                                </div>

                                {/* Highlights */}
                                <ul className="space-y-1.5">
                                    {report.highlights.map((h, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                            <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                                            {h}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
