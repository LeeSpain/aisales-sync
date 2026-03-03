import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CreditCard, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const Billing = () => {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("*").eq("company_id", profile!.company_id!).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
    enabled: !!profile?.company_id,
  });

  const plans = [
    { name: "Starter", price: "€750", setup: "€2,500", features: ["3 campaigns", "500 leads/mo", "100 emails/mo"] },
    { name: "Growth", price: "€1,250", setup: "€3,500", features: ["10 campaigns", "2,000 leads/mo", "500 emails/mo", "50 AI calls/mo"], popular: true },
    { name: "Enterprise", price: "Custom", setup: "Custom", features: ["Unlimited everything", "Dedicated manager", "Custom AI training"] },
  ];

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Billing</h1>
      <p className="text-muted-foreground mb-8">Manage your subscription and payment details</p>

      {/* Current plan */}
      <div className="rounded-xl border border-border bg-card p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current Plan</p>
            <p className="text-xl font-bold capitalize">{subscription?.plan || "No active plan"}</p>
            {subscription && <p className="text-sm text-muted-foreground capitalize">Status: {subscription.status}</p>}
          </div>
          <Button variant="outline">
            <ExternalLink className="h-4 w-4 mr-2" /> Manage in Stripe
          </Button>
        </div>
      </div>

      {/* Plans */}
      <h3 className="font-semibold mb-4">Available Plans</h3>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.name} className={`rounded-xl border p-6 ${plan.popular ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
            {plan.popular && <span className="text-[10px] font-semibold uppercase text-primary">Most Popular</span>}
            <h4 className="text-lg font-bold">{plan.name}</h4>
            <p className="text-2xl font-bold mt-2">{plan.price}<span className="text-sm text-muted-foreground font-normal">/mo</span></p>
            <p className="text-xs text-muted-foreground mb-4">{plan.setup} setup</p>
            <ul className="space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="text-sm flex items-center gap-2">
                  <span className="text-primary">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Billing;
