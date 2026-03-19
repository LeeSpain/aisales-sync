import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Target, Users, Mail, MessageSquare, Workflow,
  Clock, Check, X, Eye, Send, FileText, CheckCircle, Linkedin,
  Phone, AlertTriangle, Edit3, ChevronDown, ChevronUp, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { leadStatusColors } from "@/lib/constants";

const emailStatusConfig: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  pending_approval: { label: "Pending", color: "bg-amber-500/10 text-amber-400", icon: Clock },
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  approved: { label: "Approved", color: "bg-success/10 text-success", icon: CheckCircle },
  sent: { label: "Sent", color: "bg-blue-500/10 text-blue-400", icon: Send },
  opened: { label: "Opened", color: "bg-amber-500/10 text-amber-400", icon: Eye },
  replied: { label: "Replied", color: "bg-emerald-500/10 text-emerald-400", icon: CheckCircle },
  blocked: { label: "Blocked", color: "bg-destructive/10 text-destructive", icon: X },
  rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive", icon: X },
  pending_manual: { label: "Manual Send", color: "bg-accent/10 text-accent", icon: Linkedin },
};

const channelIcons: Record<string, typeof Mail> = { email: Mail, linkedin: Linkedin, phone: Phone };

const CampaignDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"overview" | "approval" | "leads">("overview");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => { const { data } = await supabase.from("profiles").select("company_id").eq("id", user!.id).single(); return data; },
    enabled: !!user,
  });

  const { data: campaign } = useQuery({
    queryKey: ["campaign", id],
    queryFn: async () => { const { data } = await supabase.from("campaigns").select("*").eq("id", id!).single(); return data; },
    enabled: !!id,
  });

  const { data: leads } = useQuery({
    queryKey: ["campaign-leads", id],
    queryFn: async () => { const { data } = await supabase.from("leads").select("*").eq("campaign_id", id!).order("score", { ascending: false }); return data || []; },
    enabled: !!id,
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["campaign-messages", id],
    queryFn: async () => {
      const { data } = await supabase.from("outreach_messages")
        .select("*, leads(id, business_name, contact_name, contact_role, contact_email, score, email_verification_status)")
        .eq("campaign_id", id!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: async (emailId: string) => {
      await supabase.from("outreach_messages").update({ status: "approved" }).eq("id", emailId);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["campaign-messages"] }); toast({ title: "Approved" }); },
    onError: () => { toast({ title: "Error", description: "Failed to approve email.", variant: "destructive" }); },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ emailId, reason }: { emailId: string; reason: string }) => {
      await supabase.from("outreach_messages").update({ status: "rejected", metadata: { rejected_reason: reason, rejected_at: new Date().toISOString() } }).eq("id", emailId);
    },
    onSuccess: () => { setRejectingId(null); setRejectReason(""); queryClient.invalidateQueries({ queryKey: ["campaign-messages"] }); toast({ title: "Rejected" }); },
    onError: () => { toast({ title: "Error", description: "Failed to reject email.", variant: "destructive" }); },
  });

  const editApproveMutation = useMutation({
    mutationFn: async ({ emailId, subject, body }: { emailId: string; subject: string; body: string }) => {
      await supabase.from("outreach_messages").update({ subject, body, status: "approved", metadata: { edited_before_approval: true, edited_at: new Date().toISOString() } }).eq("id", emailId);
    },
    onSuccess: () => { setEditingId(null); queryClient.invalidateQueries({ queryKey: ["campaign-messages"] }); toast({ title: "Edited & Approved" }); },
    onError: () => { toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" }); },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await supabase.from("outreach_messages").update({ status: "approved" }).in("id", ids);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["campaign-messages"] }); toast({ title: "All approved" }); },
    onError: () => { toast({ title: "Error", description: "Failed to approve emails.", variant: "destructive" }); },
  });

  // Mark as reviewed when expanded
  const markReviewed = async (emailId: string) => {
    const msg = messages?.find((m) => m.id === emailId);
    const meta = (msg?.metadata as Record<string, unknown>) || {};
    if (!meta.reviewed_at) {
      await supabase.from("outreach_messages").update({ metadata: { ...meta, reviewed_at: new Date().toISOString() } }).eq("id", emailId);
    }
  };

  const toggleExpand = (emailId: string) => {
    if (expandedId === emailId) {
      setExpandedId(null);
    } else {
      setExpandedId(emailId);
      markReviewed(emailId);
    }
  };

  // Filtered messages
  const emailMessages = messages?.filter((m) => m.channel === "email") || [];
  const filteredMessages = approvalFilter === "all" ? emailMessages :
    approvalFilter === "pending" ? emailMessages.filter((m) => m.status === "pending_approval") :
    approvalFilter === "approved" ? emailMessages.filter((m) => m.status === "approved") :
    approvalFilter === "rejected" ? emailMessages.filter((m) => m.status === "rejected") :
    approvalFilter === "flagged" ? emailMessages.filter((m) => { const meta = (m.metadata as Record<string, unknown>) || {}; return ((meta.quality_flags as string[]) || []).length > 0; }) :
    emailMessages;

  const pendingIds = emailMessages.filter((m) => m.status === "pending_approval").map((m) => m.id);
  const approvedCount = emailMessages.filter((m) => m.status === "approved" || m.status === "sent").length;
  const rejectedCount = emailMessages.filter((m) => m.status === "rejected").length;
  const reviewedCount = emailMessages.filter((m) => { const meta = (m.metadata as Record<string, unknown>) || {}; return !!meta.reviewed_at; }).length;

  if (!campaign) {
    return <div className="flex items-center justify-center h-full"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "approval" as const, label: "Approval Queue", count: pendingIds.length },
    { key: "leads" as const, label: "Leads", count: leads?.length },
  ];

  return (
    <div className="p-4 md:p-8">
      <button onClick={() => navigate("/campaigns")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Campaigns
      </button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold truncate">{campaign.name}</h1>
          <p className="text-muted-foreground text-sm">{campaign.target_description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary uppercase">{campaign.status}</span>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/campaigns/${id}/sequence`)}>
            <Workflow className="h-3.5 w-3.5" /> Sequence
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 mb-6">
        {[
          { label: "Leads Found", value: campaign.leads_found ?? 0, icon: Users },
          { label: "Qualified", value: campaign.leads_qualified ?? 0, icon: Target },
          { label: "Emails", value: emailMessages.length, icon: Mail },
          { label: "Approved", value: approvedCount, icon: CheckCircle },
          { label: "Replies", value: campaign.replies_received ?? 0, icon: MessageSquare },
          { label: "Meetings", value: campaign.meetings_booked ?? 0, icon: Target },
          { label: "Deals Won", value: campaign.deals_won ?? 0, icon: Target },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
            activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">{tab.count}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* ═══════ OVERVIEW TAB ═══════ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* All messages list */}
          {messages && messages.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-6 py-4">
                <h3 className="font-semibold">All Outreach ({messages.length})</h3>
              </div>
              <div className="divide-y divide-border">
                {messages.slice(0, 20).map((msg: Record<string, unknown>) => {
                  const channel = (msg.channel as string) || "email";
                  const status = (msg.status as string) || "draft";
                  const st = emailStatusConfig[status] || emailStatusConfig.draft;
                  const StIcon = st.icon;
                  const ChIcon = channelIcons[channel] || Mail;
                  const lead = msg.leads as Record<string, unknown> | null;

                  return (
                    <div key={msg.id as string} className="px-6 py-3 flex items-center gap-4">
                      <ChIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{msg.subject as string}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {lead?.business_name as string || "Unknown"} {lead?.contact_name ? `· ${lead.contact_name}` : ""}
                        </p>
                      </div>
                      <Badge className={cn("text-[10px] gap-1 shrink-0", st.color)}>
                        <StIcon className="h-3 w-3" /> {st.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(msg.created_at as string).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ APPROVAL QUEUE TAB ═══════ */}
      {activeTab === "approval" && (
        <div className="space-y-4">
          {/* Bulk actions bar */}
          <div className="sticky top-0 z-10 rounded-xl border border-border bg-card p-4 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {["all", "pending", "approved", "rejected", "flagged"].map((f) => (
                <button key={f} onClick={() => setApprovalFilter(f)} className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                  approvalFilter === f ? "gradient-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                )}>{f}</button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {reviewedCount}/{emailMessages.length} reviewed · {approvedCount} approved · {rejectedCount} rejected
              </span>
              {pendingIds.length > 0 && (
                <Button size="sm" className="gradient-primary border-0 text-white gap-1.5 text-xs" onClick={() => bulkApproveMutation.mutate(pendingIds)}>
                  <Check className="h-3 w-3" /> Approve All ({pendingIds.length})
                </Button>
              )}
            </div>
          </div>

          {/* Email cards */}
          {filteredMessages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <Mail className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {approvalFilter === "pending" ? "No pending emails. All caught up!" : "No emails match this filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMessages.map((msg: Record<string, unknown>) => {
                const msgId = msg.id as string;
                const status = (msg.status as string) || "draft";
                const st = emailStatusConfig[status] || emailStatusConfig.draft;
                const StIcon = st.icon;
                const lead = msg.leads as Record<string, unknown> | null;
                const meta = (msg.metadata as Record<string, unknown>) || {};
                const qualityFlags = (meta.quality_flags as string[]) || [];
                const isExpanded = expandedId === msgId;
                const isEditing = editingId === msgId;
                const isRejecting = rejectingId === msgId;
                const isPending = status === "pending_approval";

                return (
                  <div key={msgId} className={cn(
                    "rounded-xl border bg-card overflow-hidden transition-all",
                    isPending ? "border-amber-500/20" : status === "blocked" ? "border-destructive/20" : "border-border"
                  )}>
                    {/* Header row */}
                    <div className="px-5 py-3 flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(msgId)}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium truncate">{lead?.business_name as string || "Unknown"}</p>
                          {lead?.score && (
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded",
                              (lead.score as number) >= 4 ? "bg-emerald-500/10 text-emerald-400" : "bg-primary/10 text-primary"
                            )}>{(lead.score as number).toFixed(1)}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {lead?.contact_name as string || "No contact"} {lead?.contact_role ? `· ${lead.contact_role}` : ""}
                          {lead?.contact_email ? ` · ${lead.contact_email}` : ""}
                        </p>
                      </div>

                      {qualityFlags.length > 0 && (
                        <div className="flex gap-1">
                          {qualityFlags.map((flag) => (
                            <Badge key={flag} variant="outline" className="text-[9px] text-amber-400 border-amber-400/30 gap-0.5">
                              <AlertTriangle className="h-2.5 w-2.5" /> {flag.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <Badge className={cn("text-[10px] gap-1 shrink-0", st.color)}>
                        <StIcon className="h-3 w-3" /> {st.label}
                      </Badge>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>

                    {/* Subject line */}
                    <div className="px-5 pb-2">
                      <p className="text-xs text-muted-foreground">Subject:</p>
                      <p className="text-sm font-medium">{msg.subject as string}</p>
                    </div>

                    {/* Expanded view */}
                    {isExpanded && (
                      <div className="px-5 pb-4 space-y-3 border-t border-border/50 pt-3">
                        {/* Blocked reason */}
                        {msg.blocked_reason && (
                          <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 flex items-start gap-2">
                            <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-destructive">Blocked</p>
                              <p className="text-xs text-muted-foreground">{msg.blocked_reason as string}</p>
                            </div>
                          </div>
                        )}

                        {/* Email body */}
                        {isEditing ? (
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Subject</p>
                              <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Body</p>
                              <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} className="min-h-[200px] text-sm" />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" className="gradient-primary border-0 text-white gap-1" onClick={() => editApproveMutation.mutate({ emailId: msgId, subject: editSubject, body: editBody })}>
                                <Check className="h-3 w-3" /> Save & Approve
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-muted/20 p-4 text-sm whitespace-pre-wrap leading-relaxed">{msg.body as string}</div>
                        )}

                        {/* Reject reason input */}
                        {isRejecting && (
                          <div className="flex gap-2">
                            <Input placeholder="Reason for rejection..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="text-sm" />
                            <Button size="sm" variant="destructive" onClick={() => rejectMutation.mutate({ emailId: msgId, reason: rejectReason })}>Reject</Button>
                            <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)}>Cancel</Button>
                          </div>
                        )}

                        {/* Action buttons */}
                        {isPending && !isEditing && !isRejecting && (
                          <div className="flex items-center gap-2 pt-2">
                            <Button size="sm" className="gradient-primary border-0 text-white gap-1" onClick={() => approveMutation.mutate(msgId)}>
                              <Check className="h-3 w-3" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => { setEditingId(msgId); setEditSubject(msg.subject as string); setEditBody(msg.body as string); }}>
                              <Edit3 className="h-3 w-3" /> Edit & Approve
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive gap-1" onClick={() => setRejectingId(msgId)}>
                              <X className="h-3 w-3" /> Reject
                            </Button>
                            {lead?.id && (
                              <button onClick={() => navigate(`/leads/${lead.id}`)} className="ml-auto text-xs text-muted-foreground hover:text-primary">
                                View Lead
                              </button>
                            )}
                          </div>
                        )}

                        {/* Send status for approved emails */}
                        {(status === "approved" || status === "sent" || status === "opened" || status === "replied") && (
                          <div className="flex items-center gap-3 text-xs">
                            {["approved", "sent", "opened", "replied"].map((step) => {
                              const reached = ["approved", "sent", "opened", "replied"].indexOf(status) >= ["approved", "sent", "opened", "replied"].indexOf(step);
                              return (
                                <div key={step} className={cn("flex items-center gap-1 capitalize", reached ? "text-foreground" : "text-muted-foreground/40")}>
                                  {reached ? <Check className="h-3 w-3 text-success" /> : <div className="h-3 w-3 rounded-full border border-muted-foreground/30" />}
                                  {step === "approved" ? "Queued" : step}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════ LEADS TAB ═══════ */}
      {activeTab === "leads" && (
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
                  {lead.contact_name && (
                    <span className="text-xs text-muted-foreground hidden md:block">{lead.contact_name}</span>
                  )}
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", leadStatusColors[lead.status] || "bg-muted text-muted-foreground")}>
                    {lead.status?.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">No leads yet.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default CampaignDetail;
