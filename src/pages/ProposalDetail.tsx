import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    ArrowLeft,
    Send,
    Eye,
    CheckCircle,
    XCircle,
    FileText,
    Building2,
    User,
    Calendar,
    Mail,
    Clock,
    Check,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
    pending_approval: { label: "Pending Approval", color: "bg-amber-500/10 text-amber-400", icon: Clock },
    draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
    approved: { label: "Approved", color: "bg-success/10 text-success", icon: CheckCircle },
    sent: { label: "Sent", color: "bg-blue-500/10 text-blue-400", icon: Send },
    opened: { label: "Viewed", color: "bg-amber-500/10 text-amber-400", icon: Eye },
    replied: { label: "Replied", color: "bg-emerald-500/10 text-emerald-400", icon: CheckCircle },
    failed: { label: "Failed", color: "bg-destructive/10 text-destructive", icon: XCircle },
};

const ProposalDetail = () => {
    const { id } = useParams<{ id: string }>();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: email, isLoading } = useQuery({
        queryKey: ["proposal-detail", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("outreach_emails")
                .select("*, leads(business_name, contact_name, contact_email, industry, city)")
                .eq("id", id!)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (!email) {
        return (
            <div className="p-8 text-center">
                <p className="text-muted-foreground">Proposal not found</p>
                <Button asChild className="mt-4" variant="outline">
                    <Link to="/proposals">Back to Proposals</Link>
                </Button>
            </div>
        );
    }

    const getStatusKey = (): string => {
        if (email.replied_at) return "replied";
        if (email.opened_at) return "opened";
        if (email.sent_at) return "sent";
        if (email.status === "approved") return "approved";
        if (email.status === "pending_approval") return "pending_approval";
        return "draft";
    };

    const statusKey = getStatusKey();
    const status = statusConfig[statusKey] || statusConfig.draft;
    const StatusIcon = status.icon;
    const lead = email.leads as any;
    const isPending = statusKey === "pending_approval" || statusKey === "draft";

    const handleApprove = async () => {
        const { error } = await supabase
            .from("outreach_emails")
            .update({ status: "approved" })
            .eq("id", email.id);
        if (error) {
            toast({ title: "Error", description: "Failed to approve", variant: "destructive" });
        } else {
            toast({ title: "Approved", description: "Email approved and queued for sending." });
            queryClient.invalidateQueries({ queryKey: ["proposal-detail", id] });
            queryClient.invalidateQueries({ queryKey: ["proposals"] });
        }
    };

    const handleReject = async () => {
        const { error } = await supabase
            .from("outreach_emails")
            .update({ status: "rejected" })
            .eq("id", email.id);
        if (error) {
            toast({ title: "Error", description: "Failed to reject", variant: "destructive" });
        } else {
            toast({ title: "Rejected", description: "Email has been rejected and won't be sent." });
            queryClient.invalidateQueries({ queryKey: ["proposal-detail", id] });
            queryClient.invalidateQueries({ queryKey: ["proposals"] });
        }
    };

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
                    <h1 className="text-2xl font-bold">{email.subject}</h1>
                    <p className="text-muted-foreground text-sm">
                        To {lead?.business_name || "Unknown"}
                    </p>
                </div>
                <Badge className={cn("text-xs gap-1", status.color)}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                </Badge>
            </div>

            {/* Approval banner for pending items */}
            {isPending && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Clock className="h-5 w-5 text-amber-400" />
                            <div>
                                <p className="text-sm font-semibold text-amber-400">Awaiting Your Approval</p>
                                <p className="text-xs text-muted-foreground">
                                    Review the email content below, then approve to send or reject to discard.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                className="gradient-primary border-0 text-white gap-1.5"
                                onClick={handleApprove}
                            >
                                <Check className="h-3.5 w-3.5" />
                                Approve & Send
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={handleReject}
                            >
                                <X className="h-3.5 w-3.5" />
                                Reject
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Meta cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <User className="h-3.5 w-3.5" /> Contact
                    </div>
                    <p className="text-sm font-medium">{lead?.contact_name || "—"}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Building2 className="h-3.5 w-3.5" /> Company
                    </div>
                    <p className="text-sm font-medium">{lead?.business_name || "—"}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Mail className="h-3.5 w-3.5" /> Email
                    </div>
                    <p className="text-sm font-medium truncate">{lead?.contact_email || "—"}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Calendar className="h-3.5 w-3.5" /> Type
                    </div>
                    <p className="text-sm font-medium capitalize">{email.email_type || "outreach"}</p>
                </div>
            </div>

            {/* Email body */}
            <div className="rounded-xl border border-border bg-card p-6 mb-6">
                <h3 className="text-lg font-semibold mb-3">Email Content</h3>
                <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                    {email.body}
                </div>
            </div>

            {/* Timeline */}
            <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold mb-4">Activity</h3>
                <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Created {new Date(email.created_at).toLocaleString()}</span>
                    </div>
                    {email.status === "approved" && (
                        <div className="flex items-center gap-3 text-sm">
                            <div className="h-2 w-2 rounded-full bg-success" />
                            <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Approved by you</span>
                        </div>
                    )}
                    {email.sent_at && (
                        <div className="flex items-center gap-3 text-sm">
                            <div className="h-2 w-2 rounded-full bg-blue-400" />
                            <Send className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Sent {new Date(email.sent_at).toLocaleString()}</span>
                        </div>
                    )}
                    {email.opened_at && (
                        <div className="flex items-center gap-3 text-sm">
                            <div className="h-2 w-2 rounded-full bg-amber-400" />
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Opened {new Date(email.opened_at).toLocaleString()}</span>
                        </div>
                    )}
                    {email.clicked_at && (
                        <div className="flex items-center gap-3 text-sm">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Clicked {new Date(email.clicked_at).toLocaleString()}</span>
                        </div>
                    )}
                    {email.replied_at && (
                        <div className="flex items-center gap-3 text-sm">
                            <div className="h-2 w-2 rounded-full bg-emerald-400" />
                            <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Replied {new Date(email.replied_at).toLocaleString()}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProposalDetail;
