import { useState, useEffect } from "react";
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
  Loader2, AlertTriangle,
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

  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);

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

  // Poll pipeline status
  const { data: pipelineRun } = useQuery({
    queryKey: ["pipeline-run", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_runs")
        .select("id, status, current_stage, progress_message, leads_discovered, leads_qualified, messages_generated, error_message")
        .eq("campaign_id", id!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const run = query.state.data;
      return run?.status === "running" ? 2000 : false;
    },
  });

  const pipelineRunning = pipelineRun?.status === "running";
  const pipelineFailed = pipelineRun?.status === "failed";

  // Auto-refresh when pipeline finishes — MUST be in useEffect (not render body)
  const [prevStatus, setPrevStatus] = useState<string | null>(null);
  useEffect(() => {
    if (pipelineRun?.status === "completed" && prevStatus === "running") {
      queryClient.invalidateQueries({ queryKey: ["campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["campaign-leads", id] });
      queryClient.invalidateQueries({ queryKey: ["campaign-messages", id] });
    }
    if (pipelineRun?.status != null && pipelineRun.status !== prevStatus) {
      setPrevStatus(pipelineRun.status);
    }
  }, [pipelineRun?.status, prevStatus, queryClient, id]);

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
      return;
    }
    toast({ title: "Approved", description: "Sending email..." });
    queryClient.invalidateQueries({ queryKey: ["campaign-messages"] });

    // Trigger actual email send via edge function
    const { error: sendErr } = await supabase.functions.invoke("send-outreach", {
      body: { emailId },
    });
    if (sendErr) {
      console.error("send-outreach error:", sendErr);
      toast({ title: "Send failed", description: "Email approved but failed to send. It will retry automatically.", variant: "destructive" });
    } else {
      toast({ title: "Sent", description: "Email sent successfully." });
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
      return;
    }
    toast({ title: "All Approved", description: `Sending ${ids.length} emails...` });
    queryClient.invalidateQueries({ queryKey: ["campaign-messages"] });

    // Send each approved email
    let sent = 0;
    for (const emailId of ids) {
      const { error: sendErr } = await supabase.functions.invoke("send-outreach", { body: { emailId } });
      if (!sendErr) sent++;
    }
    toast({ title: "Batch complete", description: `${sent} of ${ids.length} emails sent.` });
    queryClient.invalidateQueries({ queryKey: ["campaign-messages"] });
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
          { label: "Leads Found", value: campaign.leads_found ?? 0, icon: Users },
          { label: "Qualified", value: campaign.leads_qualified ?? 0, icon: Target },
          { label: "Messages Sent", value: campaign.emails_sent ?? 0, icon: Mail },
          { label: "Replies", value: campaign.replies_received ?? 0, icon: MessageSquare },
          { label: "Calls Made", value: campaign.calls_made ?? 0, icon: Target },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ═══════ PIPELINE STATUS BANNER ═══════ */}
      {pipelineRunning && pipelineRun && (() => {
        const stageMap: Record<string, number> = {
          discovering: 1, saving_leads: 1, researching: 2, scoring: 3,
          decision_makers: 4, enriching: 4,
          generating_outreach: 5, generating_emails: 5, generating_linkedin: 5,
          generating_calls: 5, quality_check: 5, finalizing: 5,
        };
        const stageLabels = ["Finding businesses", "Researching websites", "Scoring leads", "Finding contacts", "Writing emails"];
        const currentNum = stageMap[pipelineRun.current_stage] || 1;
        const progressPct = (currentNum / 5) * 100;
        return (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 mb-6 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary">AI is working... Currently: {stageLabels[currentNum - 1]}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pipelineRun.progress_message || "Processing..."}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="h-2.5 w-full rounded-full bg-muted/50 overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-700 ease-out" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground text-right">Stage {currentNum} of 5</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-card p-2.5 text-center">
                <p className="text-lg font-bold">{pipelineRun.leads_discovered ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Discovered</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-2.5 text-center">
                <p className="text-lg font-bold text-primary">{pipelineRun.leads_qualified ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Qualified</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-2.5 text-center">
                <p className="text-lg font-bold text-accent">{pipelineRun.messages_generated ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Emails</p>
              </div>
            </div>
          </div>
        );
      })()}

      {pipelineFailed && pipelineRun && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 mb-6 flex items-center gap-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">Pipeline stopped</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pipelineRun.error_message || "An error occurred. Any leads and emails created before the error are still available below."}
            </p>
          </div>
        </div>
      )}

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
              const isExpanded = expandedMessage === email.id;
              return (
                <div key={email.id}>
                  <div
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
                        onClick={() => setExpandedMessage(isExpanded ? null : email.id)}
                        className="text-muted-foreground hover:text-primary ml-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-6 py-4 bg-muted/20 border-t border-border/50">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Subject</p>
                      <p className="text-sm font-medium mb-3">{email.subject}</p>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Body</p>
                      <div className="text-sm whitespace-pre-wrap bg-card rounded-lg border border-border p-4">{email.body}</div>
                    </div>
                  )}
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
