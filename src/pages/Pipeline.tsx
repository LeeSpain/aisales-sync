import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Columns3,
    Plus,
    DollarSign,
    Building2,
    User,
    GripVertical,
    ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
interface Deal {
    id: string;
    title: string;
    company: string;
    contact: string;
    value: number;
    stage: string;
    probability: number;
    updated_at: string;
}

const stages = [
    { key: "qualifying", label: "Qualifying", color: "border-t-blue-500" },
    { key: "proposal", label: "Proposal", color: "border-t-indigo-500" },
    { key: "negotiating", label: "Negotiating", color: "border-t-amber-500" },
    { key: "won", label: "Won", color: "border-t-emerald-500" },
    { key: "lost", label: "Lost", color: "border-t-red-500" },
];

/* ─── Demo deals (will be replaced by Supabase query when deals table exists) ─── */
const demoDeals: Deal[] = [
    { id: "1", title: "Enterprise Onboarding", company: "TechVentures Ltd", contact: "Sarah Johnson", value: 24500, stage: "qualifying", probability: 30, updated_at: "2024-03-01" },
    { id: "2", title: "Sales Automation Suite", company: "GrowthCo", contact: "Mark Williams", value: 18000, stage: "qualifying", probability: 40, updated_at: "2024-02-28" },
    { id: "3", title: "Full Pipeline Setup", company: "MediaGroup Inc", contact: "Emma Davis", value: 32000, stage: "proposal", probability: 55, updated_at: "2024-02-27" },
    { id: "4", title: "AI Outreach Package", company: "StartupLab", contact: "Alex Chen", value: 12000, stage: "proposal", probability: 60, updated_at: "2024-02-26" },
    { id: "5", title: "Enterprise Deal", company: "BigCorp", contact: "James Wilson", value: 48000, stage: "negotiating", probability: 75, updated_at: "2024-02-25" },
    { id: "6", title: "Starter Package", company: "LocalBiz", contact: "Lisa Brown", value: 5500, stage: "won", probability: 100, updated_at: "2024-02-20" },
    { id: "7", title: "Quarterly Contract", company: "RetailPlus", contact: "Tom Harris", value: 15000, stage: "won", probability: 100, updated_at: "2024-02-18" },
    { id: "8", title: "Pilot Program", company: "TestDrive Co", contact: "Amy Foster", value: 8000, stage: "lost", probability: 0, updated_at: "2024-02-15" },
];

const Pipeline = () => {
    const [deals] = useState<Deal[]>(demoDeals);

    const getStageDeals = (stageKey: string) => deals.filter((d) => d.stage === stageKey);
    const getStageValue = (stageKey: string) =>
        getStageDeals(stageKey).reduce((sum, d) => sum + d.value, 0);

    const totalPipeline = deals
        .filter((d) => !["won", "lost"].includes(d.stage))
        .reduce((sum, d) => sum + d.value, 0);

    const totalWon = getStageValue("won");

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Deal Pipeline</h1>
                    <p className="text-muted-foreground text-sm">
                        Manage deals and track revenue · Pipeline: £{totalPipeline.toLocaleString()} · Won: £{totalWon.toLocaleString()}
                    </p>
                </div>
                <Button size="sm" className="gap-1.5 gradient-primary text-white border-0">
                    <Plus className="h-3.5 w-3.5" />
                    New Deal
                </Button>
            </div>

            {/* Kanban board */}
            <div className="flex gap-4 overflow-x-auto pb-4">
                {stages.map((stage) => {
                    const stageDeals = getStageDeals(stage.key);
                    const stageValue = getStageValue(stage.key);

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
                                            {stageDeals.length}
                                        </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground font-medium">
                                        £{stageValue.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Cards */}
                            <div className="space-y-2 mt-2 min-h-[200px]">
                                {stageDeals.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-border p-6 text-center">
                                        <p className="text-xs text-muted-foreground/50">No deals</p>
                                    </div>
                                ) : (
                                    stageDeals.map((deal) => (
                                        <div
                                            key={deal.id}
                                            className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors cursor-grab group"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="flex-1 ml-1">
                                                    <p className="text-sm font-medium text-white leading-tight">{deal.title}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-xs text-muted-foreground">{deal.company}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mb-3">
                                                <User className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-xs text-muted-foreground">{deal.contact}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1">
                                                    <DollarSign className="h-3 w-3 text-emerald-400" />
                                                    <span className="text-xs font-semibold text-white">£{deal.value.toLocaleString()}</span>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] h-5">
                                                    {deal.probability}%
                                                </Badge>
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
