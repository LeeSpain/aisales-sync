import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, Users, Mail, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
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

const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

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
      const { data } = await supabase.from("outreach_messages").select("*").eq("campaign_id", id!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  if (!campaign) {
    return <div className="flex items-center justify-center h-full"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="p-8">
      <button onClick={() => navigate("/campaigns")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Campaigns
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <p className="text-muted-foreground">{campaign.target_description}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary uppercase">{campaign.status}</span>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 mb-8">
        {[
          { label: "Leads Found", value: campaign.leads_found, icon: Users },
          { label: "Qualified", value: campaign.leads_qualified, icon: Target },
          { label: "Messages Sent", value: campaign.emails_sent, icon: Mail },
          { label: "Replies", value: campaign.replies_received, icon: MessageSquare },
          { label: "Meetings", value: campaign.meetings_booked || 0, icon: Target },
          { label: "Proposals", value: campaign.proposals_sent || 0, icon: Target },
          { label: "Deals Won", value: campaign.deals_won || 0, icon: Target },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

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
                  <p className="text-xs text-muted-foreground">{lead.city} • {lead.industry}</p>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", statusColors[lead.status] || "bg-muted text-muted-foreground")}>
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
