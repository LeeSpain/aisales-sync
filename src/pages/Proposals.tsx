import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
    FileText,
    Send,
    Eye,
    CheckCircle,
    XCircle,
    Calendar,
    Building2,
    Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; color: string; icon: typeof FileText }> = {
    draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
    sent: { label: "Sent", color: "bg-blue-500/10 text-blue-400", icon: Send },
    opened: { label: "Viewed", color: "bg-amber-500/10 text-amber-400", icon: Eye },
    replied: { label: "Replied", color: "bg-emerald-500/10 text-emerald-400", icon: CheckCircle },
    failed: { label: "Failed", color: "bg-destructive/10 text-destructive", icon: XCircle },
};

const Proposals = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: async () => {
            const { data } = await supabase.from("profiles").select("company_id").eq("id", user!.id).single();
            return data;
        },
        enabled: !!user,
    });

    const { data: proposals } = useQuery({
        queryKey: ["proposals", profile?.company_id],
        queryFn: async () => {
            const { data } = await supabase
                .from("outreach_emails")
                .select("*, leads(business_name, contact_name, industry)")
                .eq("company_id", profile!.company_id!)
                .eq("email_type", "proposal")
                .order("created_at", { ascending: false });

            // If no proposal-type emails, get all emails for leads with proposal_sent status
            if (!data || data.length === 0) {
                const { data: fallback } = await supabase
                    .from("outreach_emails")
                    .select("*, leads(business_name, contact_name, industry)")
                    .eq("company_id", profile!.company_id!)
                    .order("created_at", { ascending: false })
                    .limit(50);
                return fallback || [];
            }
            return data;
        },
        enabled: !!profile?.company_id,
    });

    const getStatusKey = (email: any): string => {
        if (email.replied_at) return "replied";
        if (email.opened_at) return "opened";
        if (email.sent_at) return "sent";
        return "draft";
    };

    const statusCounts = Object.keys(statusConfig).reduce((acc, key) => {
        acc[key] = proposals?.filter((p) => getStatusKey(p) === key).length || 0;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Proposals & Outreach</h1>
                    <p className="text-muted-foreground text-sm">
                        Track outreach emails and proposals · {proposals?.length || 0} total
                    </p>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-5 gap-3 mb-6">
                {Object.entries(statusConfig).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                        <div key={key} className="rounded-xl border border-border bg-card p-3 text-center">
                            <Icon className={cn("h-4 w-4 mx-auto mb-1", config.color.split(" ")[1])} />
                            <p className="text-lg font-bold text-white">{statusCounts[key]}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{config.label}</p>
                        </div>
                    );
                })}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                {proposals && proposals.length > 0 ? (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lead</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sent</th>
                                <th className="px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {proposals.map((email: any) => {
                                const statusKey = getStatusKey(email);
                                const st = statusConfig[statusKey] || statusConfig.draft;
                                const StIcon = st.icon;
                                return (
                                    <tr key={email.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="text-sm font-medium text-white truncate max-w-[250px]">{email.subject}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="text-sm text-muted-foreground">{email.leads?.business_name || "Unknown"}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge className={cn("text-[10px] gap-1", st.color)}>
                                                <StIcon className="h-3 w-3" />
                                                {st.label}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-xs text-muted-foreground">
                                                {email.sent_at ? new Date(email.sent_at).toLocaleDateString() : "—"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => navigate(`/proposals/${email.id}`)}
                                                className="text-muted-foreground hover:text-primary"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="flex flex-col items-center py-16 text-center">
                        <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">No proposals or outreach emails yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Proposals will appear here when campaigns send outreach</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Proposals;
