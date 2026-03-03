import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Globe, Mail, Phone, MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: lead } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: emails } = useQuery({
    queryKey: ["lead-emails", id],
    queryFn: async () => {
      const { data } = await supabase.from("outreach_emails").select("*").eq("lead_id", id!).order("created_at", { ascending: false });
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

  if (!lead) {
    return <div className="flex items-center justify-center h-full"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{lead.business_name}</h1>
          <p className="text-muted-foreground">{lead.industry} • {lead.city}, {lead.country}</p>
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

      {/* Emails timeline */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-4">Outreach History ({emails?.length || 0})</h3>
        {emails && emails.length > 0 ? (
          <div className="space-y-4">
            {emails.map((email) => (
              <div key={email.id} className="border-l-2 border-primary/30 pl-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium uppercase text-primary">{email.email_type.replace("_", " ")}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", email.status === "sent" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>{email.status}</span>
                </div>
                <p className="text-sm font-medium">{email.subject}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{email.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No outreach emails yet</p>
        )}
      </div>
    </div>
  );
};

export default LeadDetail;
