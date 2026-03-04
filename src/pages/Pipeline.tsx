import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
    Columns3,
    Building2,
    User,
    GripVertical,
    Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

const stages = [
    { key: "qualifying", label: "Qualifying", color: "border-t-blue-500", statuses: ["qualified", "scored", "researched"] },
    { key: "proposal", label: "Proposal", color: "border-t-indigo-500", statuses: ["proposal_sent"] },
    { key: "negotiating", label: "Negotiating", color: "border-t-amber-500", statuses: ["negotiating", "meeting_booked", "in_conversation"] },
    { key: "won", label: "Won", color: "border-t-emerald-500", statuses: ["converted"] },
    { key: "lost", label: "Lost", color: "border-t-red-500", statuses: ["rejected"] },
];

const Pipeline = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: async () => {
            const { data } = await supabase.from("profiles").select("company_id").eq("id", user!.id).single();
            return data;
        },
        enabled: !!user,
    });

    const { data: leads } = useQuery({
        queryKey: ["pipeline-leads", profile?.company_id],
        queryFn: async () => {
            const allStatuses = stages.flatMap((s) => s.statuses);
            const { data } = await supabase
                .from("leads")
                .select("*")
                .eq("company_id", profile!.company_id!)
                .in("status", allStatuses)
                .order("score", { ascending: false, nullsFirst: false });
            return data || [];
        },
        enabled: !!profile?.company_id,
    });

    const getStageLeads = (stageKey: string) => {
        const stage = stages.find((s) => s.key === stageKey);
        if (!stage) return [];
        return leads?.filter((l) => stage.statuses.includes(l.status || "")) || [];
    };

    const getStageScore = (stageKey: string) =>
        getStageLeads(stageKey).reduce((sum, l) => sum + (l.score || 0), 0);

    const pipelineLeads = leads?.filter((l) => {
        const wonLost = ["converted", "rejected"];
        return !wonLost.includes(l.status || "");
    }) || [];

    const totalPipelineScore = pipelineLeads.reduce((sum, l) => sum + (l.score || 0), 0);
    const wonCount = getStageLeads("won").length;

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Deal Pipeline</h1>
                    <p className="text-muted-foreground text-sm">
                        Track leads through your sales pipeline · Active: {pipelineLeads.length} leads · Won: {wonCount}
                    </p>
                </div>
            </div>

            {/* Kanban board */}
            <div className="flex gap-4 overflow-x-auto pb-4">
                {stages.map((stage) => {
                    const stageLeads = getStageLeads(stage.key);

                    return (
                        <div
                            key={stage.key}
                            className="flex-shrink-0 w-[280px]"
                        >
                            {/* Column header */}
                            <div className={cn(
                                "rounded-t-xl border border-border bg-card p-3 border-t-2",
                                stage.color,
                            )}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-semibold">{stage.label}</h3>
                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                                            {stageLeads.length}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {/* Cards */}
                            <div className="space-y-2 mt-2 min-h-[200px]">
                                {stageLeads.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-border p-6 text-center">
                                        <p className="text-xs text-muted-foreground/50">No leads</p>
                                    </div>
                                ) : (
                                    stageLeads.map((lead) => (
                                        <div
                                            key={lead.id}
                                            onClick={() => navigate(`/leads/${lead.id}`)}
                                            className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer group"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="flex-1 ml-1">
                                                    <p className="text-sm font-medium text-white leading-tight">{lead.business_name}</p>
                                                </div>
                                            </div>
                                            {lead.industry && (
                                                <div className="flex items-center gap-1.5 mb-2">
                                                    <Building2 className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-xs text-muted-foreground">{lead.industry}</span>
                                                </div>
                                            )}
                                            {lead.contact_name && (
                                                <div className="flex items-center gap-1.5 mb-3">
                                                    <User className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-xs text-muted-foreground">{lead.contact_name}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1">
                                                    <Star className="h-3 w-3 text-amber-400" />
                                                    <span className="text-xs font-semibold text-white">Score: {lead.score?.toFixed(1) || "—"}</span>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground capitalize">{lead.status}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Pipeline;
