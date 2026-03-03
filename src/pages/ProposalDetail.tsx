import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Download,
    Send,
    Eye,
    CheckCircle,
    XCircle,
    FileText,
    Building2,
    User,
    Calendar,
    DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
interface ProposalSection {
    title: string;
    content: string;
}

interface Proposal {
    id: string;
    lead_name: string;
    company_name: string;
    status: "draft" | "sent" | "viewed" | "accepted" | "rejected";
    value: number;
    created_at: string;
    sent_at?: string;
    viewed_at?: string;
    sections: ProposalSection[];
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
    draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
    sent: { label: "Sent", color: "bg-blue-500/10 text-blue-400", icon: Send },
    viewed: { label: "Viewed", color: "bg-amber-500/10 text-amber-400", icon: Eye },
    accepted: { label: "Accepted", color: "bg-emerald-500/10 text-emerald-400", icon: CheckCircle },
    rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive", icon: XCircle },
};

/* ─── Demo data (will be replaced by Supabase query when proposals table exists) ─── */
const demoProposal: Proposal = {
    id: "demo-1",
    lead_name: "Sarah Johnson",
    company_name: "TechVentures Ltd",
    status: "sent",
    value: 24500,
    created_at: "2024-03-01T10:00:00Z",
    sent_at: "2024-03-01T14:30:00Z",
    sections: [
        { title: "Executive Summary", content: "Based on our analysis of TechVentures Ltd's current sales infrastructure, we propose an AI-powered sales automation solution that will increase pipeline velocity by 10x while reducing manual outreach effort by 85%." },
        { title: "Current Challenges", content: "• Manual lead discovery taking 15+ hours per week\n• Inconsistent follow-up resulting in 40% lead drop-off\n• No systematic approach to multi-channel outreach\n• Limited visibility into pipeline health" },
        { title: "Proposed Solution", content: "Media Sync's AI sales platform will automate the entire pipeline from lead discovery through to deal close. Our AI agents will handle prospecting, personalised outreach across email and LinkedIn, call scheduling, and proposal generation." },
        { title: "Implementation Timeline", content: "Week 1-2: Onboarding & AI training\nWeek 3-4: Campaign launch & optimisation\nWeek 5+: Full autonomous operation" },
        { title: "Investment", content: "Setup Fee: £2,500 (one-time)\nMonthly Subscription: £997/month\nEstimated ROI: 340% within first quarter" },
    ],
};

const ProposalDetail = () => {
    const { id } = useParams<{ id: string }>();
    const proposal = demoProposal; // Replace with Supabase query when table exists
    const status = statusConfig[proposal.status];
    const StatusIcon = status.icon;

    return (
        <div className="p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Button variant="ghost" size="icon" asChild>
                    <Link to="/proposals">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">Proposal</h1>
                    <p className="text-muted-foreground text-sm">
                        For {proposal.company_name}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5">
                        <Download className="h-3.5 w-3.5" />
                        Download PDF
                    </Button>
                    {proposal.status === "draft" && (
                        <Button size="sm" className="gap-1.5 gradient-primary text-white border-0">
                            <Send className="h-3.5 w-3.5" />
                            Send Proposal
                        </Button>
                    )}
                </div>
            </div>

            {/* Meta cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <User className="h-3.5 w-3.5" /> Contact
                    </div>
                    <p className="text-sm font-medium text-white">{proposal.lead_name}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Building2 className="h-3.5 w-3.5" /> Company
                    </div>
                    <p className="text-sm font-medium text-white">{proposal.company_name}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <DollarSign className="h-3.5 w-3.5" /> Value
                    </div>
                    <p className="text-sm font-medium text-white">£{proposal.value.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <StatusIcon className="h-3.5 w-3.5" /> Status
                    </div>
                    <Badge className={cn("text-xs", status.color)}>{status.label}</Badge>
                </div>
            </div>

            {/* Proposal sections */}
            <div className="space-y-6">
                {proposal.sections.map((section, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card p-6">
                        <h3 className="text-lg font-semibold text-white mb-3">{section.title}</h3>
                        <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                            {section.content}
                        </div>
                    </div>
                ))}
            </div>

            {/* Timeline */}
            <div className="mt-8 rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Activity</h3>
                <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Created on {new Date(proposal.created_at).toLocaleDateString()}</span>
                    </div>
                    {proposal.sent_at && (
                        <div className="flex items-center gap-3 text-sm">
                            <div className="h-2 w-2 rounded-full bg-blue-400" />
                            <Send className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Sent on {new Date(proposal.sent_at).toLocaleDateString()}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProposalDetail;
