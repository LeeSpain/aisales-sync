import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  setup: "bg-muted text-muted-foreground",
  hunting: "bg-warning/10 text-warning",
  scoring: "bg-primary/10 text-primary",
  outreach: "bg-accent/10 text-accent",
  active: "bg-success/10 text-success",
  paused: "bg-muted text-muted-foreground",
  completed: "bg-primary/10 text-primary",
};

const Campaigns = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("*").eq("company_id", profile!.company_id!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">Manage your lead discovery and outreach campaigns</p>
        </div>
        <Button className="gradient-primary border-0 text-white hover:opacity-90" onClick={() => navigate("/campaigns/new")}>
          <Plus className="h-4 w-4 mr-2" /> New Campaign
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : campaigns && campaigns.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              onClick={() => navigate(`/campaigns/${campaign.id}`)}
              className="cursor-pointer rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold truncate">{campaign.name}</h3>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase", statusColors[campaign.status] || "bg-muted text-muted-foreground")}>
                  {campaign.status}
                </span>
              </div>
              {campaign.target_description && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{campaign.target_description}</p>
              )}
              <div className="grid grid-cols-5 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold">{campaign.leads_found}</p>
                  <p className="text-[10px] text-muted-foreground">Leads</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{campaign.emails_sent}</p>
                  <p className="text-[10px] text-muted-foreground">Sent</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{campaign.replies_received}</p>
                  <p className="text-[10px] text-muted-foreground">Replies</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{campaign.meetings_booked || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Meetings</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{campaign.deals_won || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Deals</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <Target className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
          <p className="text-sm text-muted-foreground mb-6">Create your first campaign to start finding clients and building your pipeline</p>
          <Button className="gradient-primary border-0 text-white hover:opacity-90" onClick={() => navigate("/campaigns/new")}>
            <Plus className="h-4 w-4 mr-2" /> Create Campaign
          </Button>
        </div>
      )}
    </div>
  );
};

export default Campaigns;
