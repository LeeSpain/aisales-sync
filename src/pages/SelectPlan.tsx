import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, Zap, Sparkles, FlaskConical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTestMode } from "@/hooks/useTestMode";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const tiers = [
    {
        plan: "starter",
        label: "Starter",
        setup: 2500,
        monthly: 750,
        features: [
            "3 active campaigns",
            "500 leads/month",
            "100 messages/month",
            "Basic sequences",
            "Weekly report",
        ],
    },
    {
        plan: "growth",
        label: "Growth",
        setup: 3500,
        monthly: 1250,
        popular: true,
        features: [
            "10 active campaigns",
            "2,000 leads/month",
            "500 messages/month",
            "Multi-channel sequences",
            "50 AI calls/mo",
            "5 proposals/mo",
            "Deal pipeline",
            "Strategy AI",
        ],
    },
    {
        plan: "enterprise",
        label: "Enterprise",
        setup: 0,
        monthly: 0,
        features: [
            "Unlimited everything",
            "Custom AI training",
            "Dedicated account manager",
            "API access",
        ],
    },
];

const SelectPlan = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { isTestMode } = useTestMode();
    const [activating, setActivating] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const activateSubscription = async (plan: string, mode: "trial" | "paid") => {
        if (!user) {
            toast({ title: "Error", description: "Not authenticated.", variant: "destructive" });
            return;
        }

        setActivating(plan);
        const isTrial = mode === "trial";

        try {
            // Single server-side call: creates profile, company, subscription — bypasses all RLS
            const { error } = await supabase.rpc("activate_plan", {
                p_plan: plan,
                p_is_trial: isTrial,
            });

            if (error) {
                console.error("activate_plan failed:", error.message);
                toast({ title: "Error", description: error.message, variant: "destructive" });
                return;
            }

            // Invalidate the ProtectedRoute state so it allows navigation past SelectPlan
            await queryClient.invalidateQueries({ queryKey: ["flowState"] });

            toast({
                title: isTrial ? "Trial activated!" : "Subscription activated!",
                description: `You're on the ${plan} plan${isTrial ? " (14-day trial)" : ""}. Let's set up your AI sales team.`,
            });

            navigate("/onboarding");
        } catch (err) {
            console.error("activate_plan exception:", err);
            toast({ title: "Error", description: "Failed to activate. Please try again.", variant: "destructive" });
        } finally {
            setActivating(null);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
            {isTestMode && (
                <div className="mb-6 flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-sm text-emerald-400">
                    <FlaskConical className="h-4 w-4" />
                    Test Mode — Subscribe will simulate full payment (no charge)
                </div>
            )}
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary">
                <Zap className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
            <p className="text-muted-foreground text-center max-w-md mb-10">
                Select a plan to get started. Start with a{" "}
                <span className="text-primary font-semibold">14-day free trial</span> — no
                credit card required.
            </p>

            <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
                {tiers.map((tier) => (
                    <div
                        key={tier.plan}
                        className={cn(
                            "relative rounded-2xl border p-8 transition-all hover:-translate-y-1",
                            tier.popular
                                ? "border-primary bg-primary/5 shadow-lg"
                                : "border-border bg-card"
                        )}
                    >
                        {tier.popular && (
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-primary px-4 py-1 text-xs font-semibold text-white">
                                Recommended
                            </span>
                        )}

                        <h3 className="mb-1 text-xl font-semibold">{tier.label}</h3>
                        <p className="mb-4 text-sm text-muted-foreground">
                            {tier.setup > 0 ? `€${tier.setup.toLocaleString()} setup fee` : "Custom pricing"}
                        </p>

                        <div className="mb-6">
                            <span className="text-4xl font-bold">
                                {tier.monthly > 0 ? `€${tier.monthly.toLocaleString()}` : "Custom"}
                            </span>
                            {tier.monthly > 0 && (
                                <span className="text-muted-foreground">/month</span>
                            )}
                        </div>

                        <ul className="mb-8 space-y-3">
                            {tier.features.map((f) => (
                                <li key={f} className="flex items-center gap-2 text-sm">
                                    <Check className="h-4 w-4 shrink-0 text-primary" />
                                    {f}
                                </li>
                            ))}
                        </ul>

                        <div className="space-y-2">
                            {tier.plan !== "enterprise" ? (
                                <Button
                                    className={cn(
                                        "w-full gap-1.5",
                                        tier.popular
                                            ? "gradient-primary border-0 text-white hover:opacity-90"
                                            : ""
                                    )}
                                    variant={tier.popular ? "default" : "outline"}
                                    disabled={activating !== null}
                                    onClick={() => activateSubscription(tier.plan, "trial")}
                                >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {activating === tier.plan
                                        ? "Activating..."
                                        : "Start 14-Day Free Trial"}
                                </Button>
                            ) : (
                                <Button variant="outline" className="w-full" disabled>
                                    Contact Us
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SelectPlan;
