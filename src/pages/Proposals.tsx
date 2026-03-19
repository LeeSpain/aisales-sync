import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
    FileText,
    Send,
    Eye,
    CheckCircle,
    XCircle,
    Calendar,
    Building2,
    Sparkles,
    Clock,
    Check,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { emailStatusColors } from "@/lib/constants";

const statusConfig: Record<string, { label: string; color: string; icon: typeof FileText }> = {
    pending_approval: { label: "Pending Approval", color: emailStatusColors.pending_approval, icon: Clock },
    draft: { label: "Draft", color: emailStatusColors.draft, icon: FileText },
    approved: { label: "Approved", color: emailStatusColors.approved, icon: CheckCircle },
    sent: { label: "Sent", color: emailStatusColors.sent, icon: Send },
    opened: { label: "Viewed", color: emailStatusColors.opened, icon: Eye },
    replied: { label: "Replied", color: emailStatusColors.replied, icon: CheckCircle },
    failed: { label: "Failed", color: emailStatusColors.failed, icon: XCircle },
};

const Proposals = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: async () => {
            const { data } = await supabase.from("profiles").select("company_id").eq("id", user!.id).single();
            return data;
        },
        enabled: !!user,
    });

    // Get approval settings
    const { data: company } = useQuery({
        queryKey: ["company-profile", profile?.company_id],
        queryFn: async () => {
            const { data } = await supabase.from("companies").select("ai_profile").eq("id", profile!.company_id!).single();
            return data;
        },
        enabled: !!profile?.company_id,
    });

    const aiProfile = (company?.ai_profile as Record<string, unknown>) || {};
    const approval = (aiProfile.approval as Record<string, boolean>) || {};
    const requiresOutreachApproval = !approval.auto_send_outreach;
    const requiresProposalApproval = !approval.auto_send_proposals;

    const { data: proposals } = useQuery({
        queryKey: ["proposals", profile?.company_id],
        queryFn: async () => {
            const { data } = await supabase
                .from("outreach_messages")
                .select("*, leads(business_name, contact_name, industry)")
                .eq("company_id", profile!.company_id!)
                .order("created_at", { ascending: false })
                .limit(100);
            return data || [];
        },
        enabled: !!profile?.company_id,
    });

    const getStatusKey = (email: any): string => {
        if (email.replied_at) return "replied";
        if (email.opened_at) return "opened";
        if (email.sent_at) return "sent";
        if (email.status === "approved") return "approved";
        if (email.status === "pending_approval") return "pending_approval";
        // If no explicit status and approval is required, show as pending
        const isProposal = email.email_type === "proposal";
        if (!email.sent_at && ((isProposal && requiresProposalApproval) || (!isProposal && requiresOutreachApproval))) {
            return "pending_approval";
        }
        return "draft";
    };

    const handleApprove = async (emailId: string) => {
        const { error } = await supabase
            .from("outreach_messages")
            .update({ status: "approved" })
            .eq("id", emailId);
        if (error) {
            toast({ title: "Error", description: "Failed to approve", variant: "destructive" });
        } else {
            toast({ title: "Approved", description: "Email approved and queued for sending." });
            queryClient.invalidateQueries({ queryKey: ["proposals"] });
        }
    };

    const handleReject = async (emailId: string) => {
        const { error } = await supabase
            .from("outreach_messages")
            .update({ status: "rejected" })
            .eq("id", emailId);
        if (error) {
            toast({ title: "Error", description: "Failed to reject", variant: "destructive" });
        } else {
            toast({ title: "Rejected", description: "Email has been rejected and won't be sent." });
            queryClient.invalidateQueries({ queryKey: ["proposals"] });
        }
    };

    const displayStatuses = ["pending_approval", "draft", "approved", "sent", "opened", "replied", "failed"];

    const statusCounts = displayStatuses.reduce((acc, key) => {
        acc[key] = proposals?.filter((p) => getStatusKey(p) === key).length || 0;
        return acc;
    }, {} as Record<string, number>);

    // Filter out statuses with 0 count except pending_approval/draft/sent
    const visibleStatuses = displayStatuses.filter(
        (key) => statusCounts[key] > 0 || key === "pending_approval" || key === "draft" || key === "sent"
    );

    return (
        <div className="p-4 md:p-8">
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
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                {visibleStatuses.map((key) => {
                    const config = statusConfig[key];
                    if (!config) return null;
                    const Icon = config.icon;
                    return (
                        <div key={key} className="rounded-xl border border-border bg-card p-3 text-center">
                            <Icon className={cn("h-4 w-4 mx-auto mb-1", config.color.split(" ")[1])} />
                            <p className="text-lg font-bold">{statusCounts[key]}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{config.label}</p>
                        </div>
                    );
                })}
            </div>

            {/* Pending approvals banner */}
            {statusCounts.pending_approval > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-amber-400" />
                        <div>
                            <p className="text-sm font-semibold text-amber-400">
                                {statusCounts.pending_approval} {statusCounts.pending_approval === 1 ? "item" : "items"} awaiting your approval
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Review the drafts below and approve or reject before they're sent.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="rounded-xl border border-border bg-card overflow-x-auto">
                {proposals && proposals.length > 0 ? (
                    <table className="w-full min-w-[700px]">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lead</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {proposals.map((email: any) => {
                                const statusKey = getStatusKey(email);
                                const st = statusConfig[statusKey] || statusConfig.draft;
                                const StIcon = st.icon;
                                const isPending = statusKey === "pending_approval";
                                return (
                                    <tr
                                        key={email.id}
                                        className={cn(
                                            "border-b border-border last:border-0 transition-colors",
                                            isPending
                                                ? "bg-amber-500/[0.03] hover:bg-amber-500/[0.06]"
                                                : "hover:bg-muted/10"
                                        )}
                                    >
                                        <td className="px-4 py-3">
                                            <p className="text-sm font-medium truncate max-w-[250px]">{email.subject}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="text-sm text-muted-foreground">{email.leads?.business_name || "Unknown"}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs text-muted-foreground capitalize">{email.email_type || "outreach"}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge className={cn("text-[10px] gap-1", st.color)}>
                                                <StIcon className="h-3 w-3" />
                                                {st.label}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-xs text-muted-foreground">
                                                {email.sent_at
                                                    ? new Date(email.sent_at).toLocaleDateString()
                                                    : new Date(email.created_at).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {isPending && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            className="h-8 px-2.5 text-xs gradient-primary border-0 text-white"
                                                            onClick={(e) => { e.stopPropagation(); handleApprove(email.id); }}
                                                        >
                                                            <Check className="h-3 w-3 mr-1" />
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                                                            onClick={(e) => { e.stopPropagation(); handleReject(email.id); }}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => navigate(`/proposals/${email.id}`)}
                                                    className="text-muted-foreground hover:text-primary"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
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
