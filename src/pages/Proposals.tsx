import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    FileText,
    Plus,
    Send,
    Eye,
    CheckCircle,
    XCircle,
    DollarSign,
    Calendar,
    Building2,
    Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
interface Proposal {
    id: string;
    lead_name: string;
    company_name: string;
    status: "draft" | "sent" | "viewed" | "accepted" | "rejected";
    value: number;
    created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof FileText }> = {
    draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
    sent: { label: "Sent", color: "bg-blue-500/10 text-blue-400", icon: Send },
    viewed: { label: "Viewed", color: "bg-amber-500/10 text-amber-400", icon: Eye },
    accepted: { label: "Accepted", color: "bg-emerald-500/10 text-emerald-400", icon: CheckCircle },
    rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive", icon: XCircle },
};

/* ─── Demo data ─── */
const demoProposals: Proposal[] = [
    { id: "1", lead_name: "Sarah Johnson", company_name: "TechVentures Ltd", status: "sent", value: 24500, created_at: "2024-03-01" },
    { id: "2", lead_name: "Mark Williams", company_name: "GrowthCo", status: "viewed", value: 18000, created_at: "2024-02-28" },
    { id: "3", lead_name: "Emma Davis", company_name: "MediaGroup Inc", status: "accepted", value: 32000, created_at: "2024-02-25" },
    { id: "4", lead_name: "Alex Chen", company_name: "StartupLab", status: "draft", value: 12000, created_at: "2024-02-22" },
    { id: "5", lead_name: "James Wilson", company_name: "BigCorp", status: "rejected", value: 48000, created_at: "2024-02-20" },
];

const Proposals = () => {
    const totalValue = demoProposals.reduce((sum, p) => sum + p.value, 0);
    const acceptedValue = demoProposals.filter((p) => p.status === "accepted").reduce((sum, p) => sum + p.value, 0);

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Proposals</h1>
                    <p className="text-muted-foreground text-sm">
                        AI-generated commercial proposals · Total: £{totalValue.toLocaleString()} · Won: £{acceptedValue.toLocaleString()}
                    </p>
                </div>
                <Button size="sm" className="gap-1.5 gradient-primary text-white border-0">
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate Proposal
                </Button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-5 gap-3 mb-6">
                {Object.entries(statusConfig).map(([key, config]) => {
                    const Icon = config.icon;
                    const count = demoProposals.filter((p) => p.status === key).length;
                    return (
                        <div key={key} className="rounded-xl border border-border bg-card p-3 text-center">
                            <Icon className={cn("h-4 w-4 mx-auto mb-1", config.color.split(" ")[1])} />
                            <p className="text-lg font-bold text-white">{count}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{config.label}</p>
                        </div>
                    );
                })}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border bg-muted/30">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Value</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {demoProposals.map((proposal) => {
                            const st = statusConfig[proposal.status];
                            const StIcon = st.icon;
                            return (
                                <tr key={proposal.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="text-sm font-medium text-white">{proposal.lead_name}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">{proposal.company_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge className={cn("text-[10px] gap-1", st.color)}>
                                            <StIcon className="h-3 w-3" />
                                            {st.label}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="text-sm font-semibold text-white">£{proposal.value.toLocaleString()}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="text-xs text-muted-foreground">{new Date(proposal.created_at).toLocaleDateString()}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                                            <Link to={`/proposals/${proposal.id}`}>
                                                <Eye className="h-3.5 w-3.5" />
                                            </Link>
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Proposals;
