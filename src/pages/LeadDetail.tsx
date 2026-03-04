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

  const getEmailStatus = (msg: any): string => {
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
      toast({ title: "Approved", description: "Email approved and queued for sending." });
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
    return <div className="flex items-center justify-center h-full"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="p-4 md:p-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 md:mb-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl md:text-2xl font-bold truncate">{lead.business_name}</h1>
          <p className="text-muted-foreground">{lead.industry} · {lead.city}, {lead.country}</p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <span className="text-xl font-bold text-primary">{lead.score?.toFixed(1) || "—"}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Info */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-semibold">Business Info</h3>
          {lead.website && <div className="flex items-center gap-2 text-sm"><Globe className="h-4 w-4 text-muted-foreground" /> <a href={lead.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{lead.website}</a></div>}
          {lead.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /> {lead.email}</div>}
          {lead.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /> {lead.phone}</div>}
          {lead.address && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" /> {lead.address}</div>}
          {lead.rating && <div className="flex items-center gap-2 text-sm"><Star className="h-4 w-4 text-warning" /> {lead.rating} ({lead.review_count} reviews)</div>}
          {lead.description && <p className="text-sm text-muted-foreground border-t border-border pt-4">{lead.description}</p>}
        </div>

        {/* Contact */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-semibold">Contact</h3>
          {lead.contact_name ? (
            <>
              <p className="text-sm"><span className="text-muted-foreground">Name:</span> {lead.contact_name}</p>
              {lead.contact_role && <p className="text-sm"><span className="text-muted-foreground">Role:</span> {lead.contact_role}</p>}
              {lead.contact_email && <p className="text-sm"><span className="text-muted-foreground">Email:</span> {lead.contact_email}</p>}
              {lead.contact_phone && <p className="text-sm"><span className="text-muted-foreground">Phone:</span> {lead.contact_phone}</p>}
              {lead.contact_linkedin_url && (
                <p className="text-sm">
                  <span className="text-muted-foreground">LinkedIn:</span>{" "}
                  <a href={lead.contact_linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">View Profile</a>
                </p>
              )}
              {lead.enrichment_source && (
                <p className="text-xs text-muted-foreground capitalize mt-2">Source: {lead.enrichment_source}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No contact info discovered yet</p>
          )}

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-medium mb-2">Score Reasoning</h4>
            <p className="text-sm text-muted-foreground">{lead.score_reasoning || "Not scored yet"}</p>
          </div>
        </div>
      </div>

      {/* Outreach History */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-4">Outreach History ({outreachMessages?.length || 0})</h3>
        {outreachMessages && outreachMessages.length > 0 ? (
          <div className="space-y-3">
            {outreachMessages.map((msg) => {
              const statusKey = getEmailStatus(msg);
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
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={cn("text-[10px] gap-1", st.color)}>
                      <StIcon className="h-3 w-3" />
                      {st.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground capitalize">{msg.email_type || "outreach"}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(msg.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {msg.subject && <p className="text-sm font-medium mb-1">{msg.subject}</p>}
                  <p className="text-xs text-muted-foreground line-clamp-3">{msg.body}</p>

                  {isPending && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs gradient-primary border-0 text-white gap-1"
                        onClick={() => handleApprove(msg.id)}
                      >
                        <Check className="h-3 w-3" /> Approve & Send
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-3 text-xs gap-1 text-muted-foreground hover:text-destructive"
                        onClick={() => handleReject(msg.id)}
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
    </div>
  );
};

export default LeadDetail;
