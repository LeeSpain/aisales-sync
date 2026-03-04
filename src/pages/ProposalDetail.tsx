import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
    draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
    sent: { label: "Sent", color: "bg-blue-500/10 text-blue-400", icon: Send },
    opened: { label: "Viewed", color: "bg-amber-500/10 text-amber-400", icon: Eye },
    replied: { label: "Replied", color: "bg-emerald-500/10 text-emerald-400", icon: CheckCircle },
    failed: { label: "Failed", color: "bg-destructive/10 text-destructive", icon: XCircle },
};

const ProposalDetail = () => {
    const { id } = useParams<{ id: string }>();

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
        return "draft";
    };

    const statusKey = getStatusKey();
    const status = statusConfig[statusKey] || statusConfig.draft;
    const StatusIcon = status.icon;
    const lead = email.leads as any;

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

            {/* Meta cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <User className="h-3.5 w-3.5" /> Contact
                    </div>
                    <p className="text-sm font-medium text-white">{lead?.contact_name || "—"}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Building2 className="h-3.5 w-3.5" /> Company
                    </div>
                    <p className="text-sm font-medium text-white">{lead?.business_name || "—"}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Mail className="h-3.5 w-3.5" /> Email
                    </div>
                    <p className="text-sm font-medium text-white truncate">{lead?.contact_email || "—"}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Calendar className="h-3.5 w-3.5" /> Type
                    </div>
                    <p className="text-sm font-medium text-white capitalize">{email.email_type || "outreach"}</p>
                </div>
            </div>

            {/* Email body */}
            <div className="rounded-xl border border-border bg-card p-6 mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">Email Content</h3>
                <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                    {email.body}
                </div>
            </div>

            {/* Timeline */}
            <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Activity</h3>
                <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Created {new Date(email.created_at).toLocaleString()}</span>
                    </div>
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
