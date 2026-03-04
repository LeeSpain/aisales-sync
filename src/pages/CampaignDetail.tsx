import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Target, Users, Mail, MessageSquare, Workflow,
  Clock, Check, X, Eye, Send, FileText, CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const leadStatusColors: Record<string, string> = {
  discovered: "bg-muted text-muted-foreground",
  researched: "bg-muted text-muted-foreground",
  scored: "bg-primary/10 text-primary",
  qualified: "bg-success/10 text-success",
  sequence_active: "bg-accent/10 text-accent",
  contacted: "bg-accent/10 text-accent",
  replied: "bg-warning/10 text-warning",
  in_conversation: "bg-warning/10 text-warning",
  meeting_booked: "bg-success/10 text-success",
  proposal_sent: "bg-primary/10 text-primary",
  negotiating: "bg-warning/10 text-warning",
  converted: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  unresponsive: "bg-muted text-muted-foreground",
};

const emailStatusConfig: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  pending_approval: { label: "Pending Approval", color: "bg-amber-500/10 text-amber-400", icon: Clock },
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  approved: { label: "Approved", color: "bg-success/10 text-success", icon: CheckCircle },
  sent: { label: "Sent", color: "bg-blue-500/10 text-blue-400", icon: Send },
  opened: { label: "Viewed", color: "bg-amber-500/10 text-amber-400", icon: Eye },
  replied: { label: "Replied", color: "bg-emerald-500/10 text-emerald-400", icon: CheckCircle },
};

const CampaignDetail = () => {
  const { id } = useParams();
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
  const requiresApproval = !approval.auto_send_outreach;

  const { data: campaign } = useQuery({
    queryKey: ["campaign", id],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: leads } = useQuery({
    queryKey: ["campaign-leads", id],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("*").eq("campaign_id", id!).order("score", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: messages } = useQuery({
    queryKey: ["campaign-messages", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("outreach_emails")
        .select("*, leads(business_name, contact_name)")
        .eq("campaign_id", id!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const getEmailStatus = (email: any): string => {
    if (email.replied_at) return "replied";
    if (email.opened_at) return "opened";
    if (email.sent_at) return "sent";
    if (email.status === "approved") return "approved";
    if (email.status === "pending_approval") return "pending_approval";
    if (!email.sent_at && requiresApproval) return "pending_approval";
    return "draft";
  };

  const handleApprove = async (emailId: string) => {
    const { error } = await supabase.from("outreach_emails").update({ status: "approved" }).eq("id", emailId);
    if (error) {
      toast({ title: "Error", description: "Failed to approve", variant: "destructive" });
    } else {
      toast({ title: "Approved", description: "Email approved and queued for sending." });
      queryClient.invalidateQueries({ queryKey: ["campaign-messages"] });
    }
  };

  const handleReject = async (emailId: string) => {
    const { error } = await supabase.from("outreach_emails").update({ status: "rejected" }).eq("id", emailId);
    if (error) {
      toast({ title: "Error", description: "Failed to reject", variant: "destructive" });
    } else {
      toast({ title: "Rejected", description: "Email rejected." });
      queryClient.invalidateQueries({ queryKey: ["campaign-messages"] });
    }
  };

  const handleApproveAll = async () => {
    const pending = messages?.filter((m) => getEmailStatus(m) === "pending_approval") || [];
    if (pending.length === 0) return;
    const ids = pending.map((m) => m.id);
    const { error } = await supabase.from("outreach_emails").update({ status: "approved" }).in("id", ids);
    if (error) {
      toast({ title: "Error", description: "Failed to approve all", variant: "destructive" });
    } else {
      toast({ title: "All Approved", description: `${ids.length} emails approved and queued for sending.` });
      queryClient.invalidateQueries({ queryKey: ["campaign-messages"] });
    }
  };

  const pendingCount = messages?.filter((m) => getEmailStatus(m) === "pending_approval").length || 0;

  if (!campaign) {
    return <div className="flex items-center justify-center h-full"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="p-4 md:p-8">
      <button onClick={() => navigate("/campaigns")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Campaigns
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6 md:mb-8">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold truncate">{campaign.name}</h1>
          <p className="text-muted-foreground text-sm">{campaign.target_description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary uppercase">{campaign.status}</span>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/campaigns/${id}/sequence`)}>
            <Workflow className="h-3.5 w-3.5" />
            Design Sequence
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 mb-8">
        {[
          { label: "Leads Found", value: campaign.leads_found, icon: Users },
          { label: "Qualified", value: campaign.leads_qualified, icon: Target },
          { label: "Messages Sent", value: campaign.emails_sent, icon: Mail },
          { label: "Replies", value: campaign.replies_received, icon: MessageSquare },
          { label: "Meetings", value: (campaign as any).meetings_booked || 0, icon: Target },
          { label: "Proposals", value: (campaign as any).proposals_sent || 0, icon: Target },
          { label: "Deals Won", value: (campaign as any).deals_won || 0, icon: Target },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Outreach Emails */}
      {messages && messages.length > 0 && (
        <div className="rounded-xl border border-border bg-card mb-8">
          <div className="border-b border-border px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">Outreach Emails ({messages.length})</h3>
              {pendingCount > 0 && (
                <Badge className="bg-amber-500/10 text-amber-400 text-[10px] gap-1">
                  <Clock className="h-3 w-3" />
                  {pendingCount} pending
                </Badge>
              )}
            </div>
            {pendingCount > 1 && (
              <Button size="sm" className="gradient-primary border-0 text-white gap-1.5 h-7 text-xs" onClick={handleApproveAll}>
                <Check className="h-3 w-3" />
                Approve All ({pendingCount})
              </Button>
            )}
          </div>

          {/* Pending approval banner */}
          {pendingCount > 0 && (
            <div className="px-6 py-3 bg-amber-500/5 border-b border-amber-500/10 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <p className="text-xs text-amber-400">
                {pendingCount} {pendingCount === 1 ? "email" : "emails"} waiting for your approval before sending.
                {requiresApproval && <span className="text-muted-foreground ml-1">Change this in Settings → Approval Preferences.</span>}
              </p>
            </div>
          )}

          <div className="divide-y divide-border">
            {messages.map((email: any) => {
              const statusKey = getEmailStatus(email);
              const st = emailStatusConfig[statusKey] || emailStatusConfig.draft;
              const StIcon = st.icon;
              const isPending = statusKey === "pending_approval";
              return (
                <div
                  key={email.id}
                  className={cn(
                    "px-6 py-3 flex items-center gap-4",
                    isPending ? "bg-amber-500/[0.02]" : ""
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{email.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      To {email.leads?.business_name || "Unknown"}
                      {email.leads?.contact_name && ` · ${email.leads.contact_name}`}
                    </p>
                  </div>
                  <Badge className={cn("text-[10px] gap-1 shrink-0", st.color)}>
                    <StIcon className="h-3 w-3" />
                    {st.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground shrink-0 w-16 text-right">
                    {new Date(email.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {isPending && (
                      <>
                        <Button
                          size="sm"
                          className="h-8 px-2.5 text-xs gradient-primary border-0 text-white"
                          onClick={() => handleApprove(email.id)}
                        >
                          <Check className="h-3 w-3 mr-0.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => handleReject(email.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <button
                      onClick={() => navigate(`/proposals/${email.id}`)}
                      className="text-muted-foreground hover:text-primary ml-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leads */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h3 className="font-semibold">Leads ({leads?.length || 0})</h3>
        </div>
        {leads && leads.length > 0 ? (
          <div className="divide-y divide-border">
            {leads.map((lead) => (
              <div key={lead.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  {lead.score?.toFixed(1) || "—"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{lead.business_name}</p>
                  <p className="text-xs text-muted-foreground">{lead.city} · {lead.industry}</p>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", leadStatusColors[lead.status] || "bg-muted text-muted-foreground")}>
                  {lead.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">No leads yet. The AI will discover and enrich leads when the campaign starts running.</div>
        )}
      </div>
    </div>
  );
};

export default CampaignDetail;
