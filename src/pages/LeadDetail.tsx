import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Globe, Mail, Phone, MapPin, Star,
  Clock, Check, X, Eye, Send, FileText, CheckCircle,
  Linkedin, TrendingUp, TrendingDown, UserCheck, Building2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const emailStatusConfig: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  pending_approval: { label: "Pending Approval", color: "bg-amber-500/10 text-amber-400", icon: Clock },
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  approved: { label: "Approved", color: "bg-success/10 text-success", icon: CheckCircle },
  sent: { label: "Sent", color: "bg-blue-500/10 text-blue-400", icon: Send },
  opened: { label: "Viewed", color: "bg-amber-500/10 text-amber-400", icon: Eye },
  replied: { label: "Replied", color: "bg-emerald-500/10 text-emerald-400", icon: CheckCircle },
};

const scoreLabel = (score: number) => {
  if (score >= 4.5) return { text: "Excellent Match", color: "text-emerald-400" };
  if (score >= 3.5) return { text: "Strong Match", color: "text-green-400" };
  if (score >= 2.5) return { text: "Moderate Match", color: "text-amber-400" };
  if (score >= 1.5) return { text: "Weak Match", color: "text-orange-400" };
  return { text: "Poor Match", color: "text-red-400" };
};

const LeadDetail = () => {
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

  const { data: lead } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: outreachMessages } = useQuery({
    queryKey: ["lead-outreach", id],
    queryFn: async () => {
      const { data } = await supabase.from("outreach_messages").select("*").eq("lead_id", id!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: calls } = useQuery({
    queryKey: ["lead-calls", id],
    queryFn: async () => {
      const { data } = await supabase.from("calls").select("*").eq("lead_id", id!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const getEmailStatus = (msg: Record<string, unknown>): string => {
    if (msg.replied_at) return "replied";
    if (msg.opened_at) return "opened";
    if (msg.sent_at) return "sent";
    if (msg.status === "approved") return "approved";
    if (msg.status === "pending_approval") return "pending_approval";
    if (!msg.sent_at && requiresApproval) return "pending_approval";
    return "draft";
  };

  const handleApprove = async (emailId: string) => {
    const { error } = await supabase.from("outreach_messages").update({ status: "approved" }).eq("id", emailId);
    if (error) {
      toast({ title: "Error", description: "Failed to approve", variant: "destructive" });
    } else {
      toast({ title: "Approved ✓", description: "Email approved and queued for sending." });
      queryClient.invalidateQueries({ queryKey: ["lead-outreach"] });
    }
  };

  const handleReject = async (emailId: string) => {
    const { error } = await supabase.from("outreach_messages").update({ status: "rejected" }).eq("id", emailId);
    if (error) {
      toast({ title: "Error", description: "Failed to reject", variant: "destructive" });
    } else {
      toast({ title: "Rejected", description: "Email rejected." });
      queryClient.invalidateQueries({ queryKey: ["lead-outreach"] });
    }
  };

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const score = lead.score as number | null;
  const sl = score ? scoreLabel(score) : null;
  const researchData = lead.research_data as Record<string, unknown> | null;
  const keyStrengths = (researchData?.key_strengths as string[]) || [];
  const keyConcerns = (researchData?.key_concerns as string[]) || [];
  const dm = researchData?.decision_maker as Record<string, unknown> | null;

  // Clean website display
  const websiteDisplay = lead.website
    ? (lead.website as string).replace(/^https?:\/\//i, "").replace(/\/$/, "")
    : null;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
            <h1 className="text-xl md:text-2xl font-bold truncate">{lead.business_name}</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {lead.industry} · {[lead.city, lead.country].filter(Boolean).join(", ")}
          </p>
          {lead.size_estimate && (
            <Badge variant="outline" className="mt-2 text-xs capitalize">
              {lead.size_estimate} business
            </Badge>
          )}
        </div>

        {/* Score badge */}
        {score !== null && score !== undefined && (
          <div className="flex flex-col items-center shrink-0">
            <div className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl font-bold text-2xl",
              score >= 4 ? "bg-emerald-500/10 text-emerald-400" :
              score >= 3 ? "bg-amber-500/10 text-amber-400" :
              "bg-red-500/10 text-red-400"
            )}>
              {score.toFixed(1)}
            </div>
            {sl && <span className={cn("text-xs mt-1 font-medium", sl.color)}>{sl.text}</span>}
            <span className="text-xs text-muted-foreground">out of 5</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Business Info ── */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" /> Business Info
          </h3>

          {websiteDisplay && (
            <a
              href={lead.website as string}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline group"
            >
              <Globe className="h-4 w-4 shrink-0" />
              {websiteDisplay}
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          )}

          {lead.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`mailto:${lead.email}`} className="hover:text-primary">{lead.email as string}</a>
            </div>
          )}

          {lead.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`tel:${lead.phone}`} className="hover:text-primary">{lead.phone as string}</a>
            </div>
          )}

          {lead.address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{lead.address as string}</span>
            </div>
          )}

          {lead.rating && (
            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-warning shrink-0" />
              <span className="font-medium">{lead.rating as number}</span>
              <span className="text-muted-foreground">/ 5 · {lead.review_count as number} reviews</span>
            </div>
          )}

          {lead.description && (
            <p className="text-sm text-muted-foreground border-t border-border pt-3 leading-relaxed">
              {lead.description as string}
            </p>
          )}
        </div>

        {/* ── Contact ── */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-muted-foreground" /> Contact
          </h3>

          {(lead.contact_name || dm?.name) ? (
            <>
              <p className="text-sm font-medium">
                {(lead.contact_name || dm?.name) as string}
                {(lead.contact_role || dm?.role) && (
                  <span className="text-muted-foreground font-normal"> · {(lead.contact_role || dm?.role) as string}</span>
                )}
              </p>

              {(lead.contact_email || dm?.email) && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`mailto:${lead.contact_email || dm?.email}`} className="hover:text-primary text-primary">
                    {(lead.contact_email || dm?.email) as string}
                  </a>
                </div>
              )}

              {(lead.contact_phone || dm?.phone) && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`tel:${lead.contact_phone || dm?.phone}`} className="hover:text-primary">
                    {(lead.contact_phone || dm?.phone) as string}
                  </a>
                </div>
              )}

              {(lead.contact_linkedin_url || dm?.linkedin_url) && (
                <div className="flex items-center gap-2 text-sm">
                  <Linkedin className="h-4 w-4 text-[#0077B5] shrink-0" />
                  <a
                    href={(lead.contact_linkedin_url || dm?.linkedin_url) as string}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    View LinkedIn Profile
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {researchData?.source && (
                <p className="text-xs text-muted-foreground capitalize mt-1">
                  Source: {(researchData.source as string).replace(/_/g, " ")}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No contact info discovered yet</p>
          )}
        </div>
      </div>

      {/* ── Score Analysis ── */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Star className="h-4 w-4 text-muted-foreground" /> Score Analysis
        </h3>

        {lead.score_reasoning ? (
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            {lead.score_reasoning as string}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Not scored yet</p>
        )}

        {(keyStrengths.length > 0 || keyConcerns.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2 mt-4 pt-4 border-t border-border">
            {keyStrengths.length > 0 && (
              <div>
                <p className="text-xs font-medium text-emerald-400 mb-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Strengths
                </p>
                <ul className="space-y-1">
                  {keyStrengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {keyConcerns.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" /> Concerns
                </p>
                <ul className="space-y-1">
                  {keyConcerns.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <X className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" /> {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Outreach History ── */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-4">
          Outreach History ({outreachMessages?.length || 0})
        </h3>

        {outreachMessages && outreachMessages.length > 0 ? (
          <div className="space-y-3">
            {outreachMessages.map((msg) => {
              const statusKey = getEmailStatus(msg as Record<string, unknown>);
              const st = emailStatusConfig[statusKey] || emailStatusConfig.draft;
              const StIcon = st.icon;
              const isPending = statusKey === "pending_approval";
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "rounded-lg border p-4",
                    isPending ? "border-amber-500/20 bg-amber-500/[0.03]" : "border-border"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge className={cn("text-[10px] gap-1", st.color)}>
                      <StIcon className="h-3 w-3" />
                      {st.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground capitalize">{msg.email_type || "outreach"}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(msg.created_at as string).toLocaleDateString()}
                    </span>
                  </div>

                  {msg.subject && (
                    <p className="text-sm font-medium mb-1">{msg.subject as string}</p>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {msg.body as string}
                  </p>

                  {isPending && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50 flex-wrap">
                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs gradient-primary border-0 text-white gap-1"
                        onClick={() => handleApprove(msg.id as string)}
                      >
                        <Check className="h-3 w-3" /> Approve & Send
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-3 text-xs gap-1 text-muted-foreground hover:text-destructive"
                        onClick={() => handleReject(msg.id as string)}
                      >
                        <X className="h-3 w-3" /> Reject
                      </Button>
                      <button
                        onClick={() => navigate(`/proposals/${msg.id}`)}
                        className="ml-auto text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" /> View full email
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No outreach messages yet</p>
        )}
      </div>

      {/* ── Calls ── (only show if there are any) */}
      {calls && calls.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Call History ({calls.length})</h3>
          <div className="space-y-2">
            {calls.map((call) => (
              <div key={call.id as string} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                <span className="text-muted-foreground">
                  {new Date(call.created_at as string).toLocaleDateString()}
                </span>
                <Badge variant="outline" className="capitalize text-xs">
                  {(call.status as string) || "completed"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadDetail;
