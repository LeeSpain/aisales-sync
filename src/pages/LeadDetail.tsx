import { useState, useCallback } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Globe, Mail, Phone, MapPin, Star,
  Clock, Check, X, Eye, Send, FileText, CheckCircle,
  Linkedin, TrendingUp, TrendingDown, UserCheck, Building2,
  ExternalLink, StickyNote, Plus, CalendarDays,
  MessageSquare, PhoneCall, Pencil, Save, Loader2, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { leadStatusColors } from "@/lib/constants";
import { ALL_STATUSES } from "@/hooks/useLeads";

const emailStatusConfig: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  pending_approval: { label: "Pending Approval", color: "bg-amber-500/10 text-amber-400", icon: Clock },
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  approved: { label: "Approved", color: "bg-success/10 text-success", icon: CheckCircle },
  sent: { label: "Sent", color: "bg-blue-500/10 text-blue-400", icon: Send },
  opened: { label: "Viewed", color: "bg-amber-500/10 text-amber-400", icon: Eye },
  replied: { label: "Replied", color: "bg-emerald-500/10 text-emerald-400", icon: CheckCircle },
  blocked: { label: "Blocked — Invalid Email", color: "bg-destructive/10 text-destructive", icon: X },
};

const scoreLabel = (score: number) => {
  if (score >= 4.5) return { text: "Excellent Match", color: "text-emerald-400" };
  if (score >= 3.5) return { text: "Strong Match", color: "text-green-400" };
  if (score >= 2.5) return { text: "Moderate Match", color: "text-amber-400" };
  if (score >= 1.5) return { text: "Weak Match", color: "text-orange-400" };
  return { text: "Poor Match", color: "text-red-400" };
};

const activityIcons: Record<string, typeof MessageSquare> = {
  email: Mail,
  call: PhoneCall,
  note: StickyNote,
  status_change: TrendingUp,
  meeting: CalendarDays,
};

const LeadDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [newNote, setNewNote] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "activity" | "outreach" | "calls">("overview");

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

  const { data: lead, isLoading: leadLoading } = useQuery({
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

  const { data: activityLog } = useQuery({
    queryKey: ["lead-activity-log", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .eq("metadata->>lead_id", id!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!id,
  });

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("leads")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id!);
      if (error) throw error;

      // Log activity
      await supabase.from("activity_log").insert({
        action: "lead_status_change",
        description: `Lead status changed to ${status.replace(/_/g, " ")}`,
        company_id: profile?.company_id,
        metadata: { lead_id: id, new_status: status, business_name: lead?.business_name },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["lead-activity-log", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Status updated" });
    },
    onError: () => { toast({ title: "Error", description: "Failed to update status.", variant: "destructive" }); },
  });

  // Lead update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const { error } = await supabase
        .from("leads")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      setIsEditing(false);
      toast({ title: "Lead updated" });
    },
    onError: () => { toast({ title: "Error", description: "Failed to update lead.", variant: "destructive" }); },
  });

  // Add note mutation
  const noteMutation = useMutation({
    mutationFn: async (note: string) => {
      await supabase.from("activity_log").insert({
        action: "note_added",
        description: note,
        company_id: profile?.company_id,
        metadata: { lead_id: id, type: "note", business_name: lead?.business_name },
      });
    },
    onSuccess: () => {
      setNewNote("");
      queryClient.invalidateQueries({ queryKey: ["lead-activity-log", id] });
      toast({ title: "Note added" });
    },
    onError: () => { toast({ title: "Error", description: "Failed to add note.", variant: "destructive" }); },
  });

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

  // Generate outreach email for this lead
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const generateEmail = useCallback(async () => {
    if (!lead || !profile?.company_id || generatingEmail) return;
    setGeneratingEmail(true);
    try {
      // Get company profile for the AI
      const { data: companyData } = await supabase.from("companies").select("*").eq("id", profile.company_id).single();
      const companyProfile = companyData
        ? { name: companyData.name, industry: companyData.industry, services: companyData.services || [], target_markets: companyData.target_markets || [], unique_selling_points: companyData.selling_points || [], tone_preference: companyData.tone_preference || "professional" }
        : { name: "Our Company", services: [], target_markets: [], unique_selling_points: [], tone_preference: "professional" };

      const { data: emailData, error: invokeErr } = await supabase.functions.invoke("generate-outreach", {
        body: { lead, companyProfile, tone: companyProfile.tone_preference },
      });

      if (invokeErr || !emailData?.subject) {
        toast({ title: "Error", description: "Failed to generate email. Check edge function logs.", variant: "destructive" });
        setGeneratingEmail(false);
        return;
      }

      // Save to outreach_messages
      const { error: insertErr } = await supabase.from("outreach_messages").insert({
        campaign_id: lead.campaign_id,
        company_id: profile.company_id,
        lead_id: lead.id,
        subject: emailData.subject,
        body: emailData.body,
        channel: "email",
        email_type: "outreach",
        status: "pending_approval",
        ai_model_used: "gemini-flash",
        metadata: { personalisation_used: emailData.personalisation_used || null, sequence_step: "manual_generate" },
      });

      if (insertErr) {
        toast({ title: "Error", description: "Email generated but failed to save.", variant: "destructive" });
      } else {
        toast({ title: "Email generated", description: "Outreach email created and waiting for your approval." });
        queryClient.invalidateQueries({ queryKey: ["lead-outreach"] });
      }
    } catch (err) {
      toast({ title: "Error", description: "Something went wrong generating the email.", variant: "destructive" });
    }
    setGeneratingEmail(false);
  }, [lead, profile, generatingEmail, queryClient, toast]);

  const getEmailStatus = (msg: Record<string, unknown>): string => {
    if (msg.status === "blocked") return "blocked";
    if (msg.replied_at) return "replied";
    if (msg.opened_at) return "opened";
    if (msg.sent_at) return "sent";
    if (msg.status === "approved") return "approved";
    if (msg.status === "pending_approval") return "pending_approval";
    if (!msg.sent_at && requiresApproval) return "pending_approval";
    return "draft";
  };

  const startEditing = () => {
    if (!lead) return;
    setEditForm({
      business_name: lead.business_name || "",
      email: (lead.email as string) || "",
      phone: (lead.phone as string) || "",
      website: (lead.website as string) || "",
      industry: lead.industry || "",
      city: lead.city || "",
      country: lead.country || "",
      contact_name: lead.contact_name || "",
      contact_email: (lead.contact_email as string) || "",
      contact_role: lead.contact_role || "",
      contact_phone: (lead.contact_phone as string) || "",
      description: (lead.description as string) || "",
    });
    setIsEditing(true);
  };

  if (leadLoading || !lead) {
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
  const websiteDisplay = lead.website
    ? (lead.website as string).replace(/^https?:\/\//i, "").replace(/\/$/, "")
    : null;

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "activity" as const, label: "Activity", count: activityLog?.length },
    { key: "outreach" as const, label: "Outreach", count: outreachMessages?.length },
    { key: "calls" as const, label: "Calls", count: calls?.length },
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Leads
      </button>

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
            <h1 className="text-xl md:text-2xl font-bold truncate">{lead.business_name}</h1>
          </div>
          <p className="text-muted-foreground text-sm mb-3">
            {lead.industry} · {[lead.city, lead.country].filter(Boolean).join(", ")}
          </p>

          {/* Status selector */}
          <div className="flex items-center gap-3">
            <Select
              value={lead.status || "discovered"}
              onValueChange={(v) => statusMutation.mutate(v)}
            >
              <SelectTrigger className={cn(
                "h-8 w-auto min-w-[140px] text-xs font-medium capitalize border-0 rounded-full px-3",
                leadStatusColors[lead.status || ""] || "bg-muted text-muted-foreground"
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize text-xs">
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lead.size_estimate && (
              <Badge variant="outline" className="text-xs capitalize">
                {lead.size_estimate} business
              </Badge>
            )}
            {lead.source && (
              <Badge variant="outline" className="text-xs capitalize">
                {(lead.source as string).replace(/_/g, " ")}
              </Badge>
            )}
            {(lead as Record<string, unknown>).email_verification_status === "invalid" && (
              <Badge className="bg-destructive/10 text-destructive text-xs gap-1">
                <X className="h-3 w-3" /> Invalid Email
              </Badge>
            )}
            {(lead as Record<string, unknown>).email_verification_status === "risky" && (
              <Badge className="bg-amber-500/10 text-amber-400 text-xs gap-1">
                <Clock className="h-3 w-3" /> Risky Email
              </Badge>
            )}
            {(lead as Record<string, unknown>).email_verification_status === "valid" && (
              <Badge className="bg-success/10 text-success text-xs gap-1">
                <Check className="h-3 w-3" /> Verified Email
              </Badge>
            )}
          </div>
        </div>

        {/* Score badge + edit button */}
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={isEditing ? () => updateMutation.mutate(editForm) : startEditing}
            className="gap-1.5"
          >
            {isEditing ? <><Save className="h-3.5 w-3.5" /> Save</> : <><Pencil className="h-3.5 w-3.5" /> Edit</>}
          </Button>
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
          )}

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
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">{tab.count}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Business Info */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" /> Business Info
              </h3>

              {isEditing ? (
                <div className="space-y-3">
                  <Input value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email" className="text-sm" />
                  <Input value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Phone" className="text-sm" />
                  <Input value={editForm.website || ""} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} placeholder="Website" className="text-sm" />
                  <Input value={editForm.industry || ""} onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })} placeholder="Industry" className="text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={editForm.city || ""} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} placeholder="City" className="text-sm" />
                    <Input value={editForm.country || ""} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} placeholder="Country" className="text-sm" />
                  </div>
                  <Textarea value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Description" className="text-sm min-h-[60px]" />
                </div>
              ) : (
                <>
                  {websiteDisplay && (
                    <a href={lead.website as string} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline group">
                      <Globe className="h-4 w-4 shrink-0" /> {websiteDisplay}
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
                </>
              )}
            </div>

            {/* Contact */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" /> Contact
              </h3>

              {isEditing ? (
                <div className="space-y-3">
                  <Input value={editForm.contact_name || ""} onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })} placeholder="Contact name" className="text-sm" />
                  <Input value={editForm.contact_role || ""} onChange={(e) => setEditForm({ ...editForm, contact_role: e.target.value })} placeholder="Role" className="text-sm" />
                  <Input value={editForm.contact_email || ""} onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })} placeholder="Contact email" className="text-sm" />
                  <Input value={editForm.contact_phone || ""} onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })} placeholder="Contact phone" className="text-sm" />
                </div>
              ) : (
                <>
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
                          <a href={(lead.contact_linkedin_url || dm?.linkedin_url) as string} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            View LinkedIn Profile <ExternalLink className="h-3 w-3" />
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
                </>
              )}
            </div>
          </div>

          {/* Score Analysis */}
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

          {/* Quick Add Note */}
          <div className="mt-6 rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-muted-foreground" /> Add Note
            </h3>
            <div className="flex gap-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note about this lead..."
                className="min-h-[60px] flex-1"
              />
              <Button
                className="gradient-primary border-0 text-white self-end"
                size="sm"
                disabled={!newNote.trim() || noteMutation.isPending}
                onClick={() => noteMutation.mutate(newNote.trim())}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Activity Tab ── */}
      {activeTab === "activity" && (
        <div className="space-y-4">
          {/* Add Note at top */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex gap-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                className="min-h-[50px] flex-1 text-sm"
              />
              <Button
                className="gradient-primary border-0 text-white self-end"
                size="sm"
                disabled={!newNote.trim() || noteMutation.isPending}
                onClick={() => noteMutation.mutate(newNote.trim())}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>

          {/* Activity Timeline */}
          {activityLog && activityLog.length > 0 ? (
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">Activity Timeline</h3>
              <div className="space-y-0">
                {activityLog.map((item, index) => {
                  const meta = (item.metadata as Record<string, unknown>) || {};
                  const type = (meta.type as string) || item.action || "note";
                  const IconComp = activityIcons[type] || MessageSquare;

                  return (
                    <div key={item.id} className="flex gap-3 group">
                      <div className="flex flex-col items-center">
                        <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-muted shrink-0">
                          <IconComp className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        {index < activityLog.length - 1 && (
                          <div className="w-px flex-1 bg-border/50 mt-1" />
                        )}
                      </div>
                      <div className="pb-5 flex-1 min-w-0">
                        <p className="text-sm">{item.description || item.action}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No activity yet. Add a note to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Outreach Tab ── */}
      {activeTab === "outreach" && (
        <div className="rounded-xl border border-border bg-card p-6">
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
                        <StIcon className="h-3 w-3" /> {st.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground capitalize">{msg.email_type || "outreach"}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(msg.created_at as string).toLocaleDateString()}
                      </span>
                    </div>
                    {msg.blocked_reason && (
                      <div className="mb-2 rounded-lg bg-destructive/5 border border-destructive/20 p-2.5 flex items-start gap-2">
                        <X className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">{msg.blocked_reason as string}</p>
                        </div>
                      </div>
                    )}
                    {msg.subject && <p className="text-sm font-medium mb-1">{msg.subject as string}</p>}
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{msg.body as string}</p>
                    {statusKey === "blocked" && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                          onClick={() => setIsEditing(true)}
                        >
                          Fix Contact
                        </Button>
                      </div>
                    )}
                    {isPending && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50 flex-wrap">
                        <Button size="sm" className="h-7 px-3 text-xs gradient-primary border-0 text-white gap-1" onClick={() => handleApprove(msg.id as string)}>
                          <Check className="h-3 w-3" /> Approve & Send
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-3 text-xs gap-1 text-muted-foreground hover:text-destructive" onClick={() => handleReject(msg.id as string)}>
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
            <div className="text-center py-8">
              <Mail className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">No outreach messages yet</p>
              <Button
                size="sm"
                className="gradient-primary border-0 text-white gap-1.5"
                onClick={generateEmail}
                disabled={generatingEmail}
              >
                {generatingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {generatingEmail ? "Writing email..." : "Write outreach email"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Calls Tab ── */}
      {activeTab === "calls" && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Call History ({calls?.length || 0})</h3>
          {calls && calls.length > 0 ? (
            <div className="space-y-3">
              {calls.map((call) => (
                <div key={call.id as string} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium capitalize">{call.call_type || "outbound"} call</span>
                    </div>
                    <Badge variant="outline" className="capitalize text-xs">
                      {(call.status as string) || "completed"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>{new Date(call.created_at as string).toLocaleString()}</p>
                    {call.duration_seconds && <p>Duration: {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s</p>}
                    {call.summary && <p className="mt-2 text-sm">{call.summary as string}</p>}
                    {call.outcome && <p className="mt-1">Outcome: {call.outcome as string}</p>}
                    {call.next_steps && <p className="mt-1">Next steps: {call.next_steps as string}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <PhoneCall className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No calls recorded yet</p>
            </div>
          )}
        </div>
      )}

      {/* ── Metadata Footer ── */}
      <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground/50">
        <span>Created: {new Date(lead.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(lead.updated_at).toLocaleString()}</span>
        <span className="font-mono">{lead.id}</span>
      </div>
    </div>
  );
};

export default LeadDetail;
