import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Mail,
    Linkedin,
    PhoneCall,
    Clock,
    Plus,
    GripVertical,
    Sparkles,
    Zap,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/* ─── Types ─── */
interface SequenceStep {
    id: string;
    order: number;
    channel: "email" | "linkedin" | "call" | "wait";
    subject?: string;
    body?: string;
    delay_days: number;
    status: "active" | "paused";
}

const channelConfig = {
    email: { icon: Mail, label: "Email", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    linkedin: { icon: Linkedin, label: "LinkedIn", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
    call: { icon: PhoneCall, label: "Call", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    wait: { icon: Clock, label: "Wait", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

const defaultSteps: SequenceStep[] = [
    { id: "1", order: 1, channel: "email", subject: "Introduction Email", body: "AI-personalised intro based on lead research", delay_days: 0, status: "active" },
    { id: "2", order: 2, channel: "wait", delay_days: 2, status: "active" },
    { id: "3", order: 3, channel: "linkedin", subject: "LinkedIn Connection Request", body: "Personalised note referencing their company", delay_days: 0, status: "active" },
    { id: "4", order: 4, channel: "wait", delay_days: 3, status: "active" },
    { id: "5", order: 5, channel: "email", subject: "Follow-Up with Value", body: "Case study or relevant resource", delay_days: 0, status: "active" },
    { id: "6", order: 6, channel: "wait", delay_days: 4, status: "active" },
    { id: "7", order: 7, channel: "call", subject: "Discovery Call", body: "AI voice call with lead context", delay_days: 0, status: "active" },
];

const SequenceDesigner = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const { toast } = useToast();
    const [steps, setSteps] = useState<SequenceStep[]>(defaultSteps);
    const [saving, setSaving] = useState(false);

    // Fetch campaign info
    const { data: campaign } = useQuery({
        queryKey: ["campaign", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("campaigns")
                .select("*")
                .eq("id", id!)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    // Load saved sequence from campaign.target_criteria
    useEffect(() => {
        if (campaign?.target_criteria) {
            const criteria = campaign.target_criteria as any;
            if (criteria.sequence_steps && Array.isArray(criteria.sequence_steps)) {
                setSteps(criteria.sequence_steps);
            }
        }
    }, [campaign]);

    const handleSave = async () => {
        if (!id) return;
        setSaving(true);
        try {
            const existingCriteria = (campaign?.target_criteria as any) || {};
            const { error } = await supabase
                .from("campaigns")
                .update({
                    target_criteria: { ...existingCriteria, sequence_steps: steps },
                })
                .eq("id", id);

            if (error) throw error;
            toast({ title: "Saved", description: "Sequence saved successfully." });
        } catch (e) {
            toast({ title: "Error", description: "Failed to save sequence.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const addStep = (channel: SequenceStep["channel"]) => {
        const newStep: SequenceStep = {
            id: crypto.randomUUID(),
            order: steps.length + 1,
            channel,
            subject: channel === "wait" ? undefined : `Step ${steps.length + 1}`,
            body: "",
            delay_days: channel === "wait" ? 2 : 0,
            status: "active",
        };
        setSteps([...steps, newStep]);
    };

    const removeStep = (stepId: string) => {
        setSteps(steps.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order: i + 1 })));
    };

    return (
        <div className="p-4 md:p-8">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3 mb-6 md:mb-8">
                <Button variant="ghost" size="icon" asChild className="shrink-0">
                    <Link to={id ? `/campaigns/${id}` : "/campaigns"}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl md:text-2xl font-bold">Sequence Designer</h1>
                    <p className="text-muted-foreground text-sm truncate">
                        {campaign?.name ?? "Campaign"} — Multi-channel outreach sequence
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        AI Build
                    </Button>
                    <Button size="sm" className="gap-1.5 gradient-primary text-white border-0" onClick={handleSave} disabled={saving}>
                        <Zap className="h-3.5 w-3.5" />
                        {saving ? "Saving..." : "Save & Activate"}
                    </Button>
                </div>
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-7 top-4 bottom-4 w-px bg-border" />

                {steps.map((step, i) => {
                    const config = channelConfig[step.channel];
                    const Icon = config.icon;
                    return (
                        <div key={step.id} className="relative flex gap-4 mb-4 group">
                            {/* Step number circle */}
                            <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center">
                                <div className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
                                    config.color,
                                )}>
                                    <Icon className="h-4.5 w-4.5" />
                                </div>
                            </div>

                            {/* Step card */}
                            <div className="flex-1 rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />
                                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                                            Step {step.order}
                                        </Badge>
                                        <Badge variant="outline" className={cn("text-[10px]", config.color)}>
                                            {config.label}
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-destructive text-xs h-7"
                                        onClick={() => removeStep(step.id)}
                                    >
                                        Remove
                                    </Button>
                                </div>

                                {step.channel === "wait" ? (
                                    <p className="text-sm text-muted-foreground">
                                        Wait <span className="text-white font-semibold">{step.delay_days} days</span> before next step
                                    </p>
                                ) : (
                                    <div>
                                        <p className="text-sm font-medium text-white/90 mb-1">{step.subject}</p>
                                        <p className="text-xs text-muted-foreground">{step.body}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add step buttons */}
            <div className="mt-6 flex flex-wrap items-center gap-2 sm:gap-3 pl-16 sm:pl-[72px]">
                <span className="text-xs text-muted-foreground mr-1">Add step:</span>
                {(Object.keys(channelConfig) as Array<keyof typeof channelConfig>).map((ch) => {
                    const config = channelConfig[ch];
                    const Icon = config.icon;
                    return (
                        <Button
                            key={ch}
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => addStep(ch)}
                        >
                            <Plus className="h-3 w-3" />
                            <Icon className="h-3 w-3" />
                            {config.label}
                        </Button>
                    );
                })}
            </div>
        </div>
    );
};

export default SequenceDesigner;
