import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const tiers = [
  {
    plan: "Starter",
    setup: "2,500",
    monthly: "750",
    features: [
      "3 active campaigns",
      "500 leads/month",
      "100 emails/month",
      "AI reply handling",
      "Dashboard & reporting",
    ],
  },
  {
    plan: "Growth",
    setup: "3,500",
    monthly: "1,250",
    popular: true,
    features: [
      "10 active campaigns",
      "2,000 leads/month",
      "500 emails/month",
      "AI voice calls (50/mo)",
      "Weekly AI report",
    ],
  },
  {
    plan: "Enterprise",
    setup: "Custom",
    monthly: "Custom",
    features: [
      "Unlimited everything",
      "Dedicated account manager",
      "Custom AI training",
      "API access",
      "Priority support",
    ],
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-24">
      <div className="container mx-auto px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">Simple Pricing</h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Setup fee + monthly subscription. No hidden costs. Cancel anytime after 6 months.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.plan}
              className={cn(
                "relative rounded-2xl border p-8 transition-all hover:-translate-y-1",
                tier.popular
                  ? "border-primary bg-primary/5 shadow-lg glow-primary"
                  : "border-border bg-card"
              )}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-primary px-4 py-1 text-xs font-semibold text-white">
                  Most Popular
                </span>
              )}

              <h3 className="mb-1 text-xl font-semibold">{tier.plan}</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {tier.setup === "Custom" ? "" : `€${tier.setup} setup fee`}
              </p>

              <div className="mb-6">
                <span className="text-4xl font-bold">
                  {tier.monthly === "Custom" ? "" : "€"}
                  {tier.monthly}
                </span>
                {tier.monthly !== "Custom" && (
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

              <Button
                asChild
                className={cn(
                  "w-full",
                  tier.popular
                    ? "gradient-primary border-0 text-white hover:opacity-90"
                    : ""
                )}
                variant={tier.popular ? "default" : "outline"}
              >
                <Link to={tier.monthly === "Custom" ? "/contact" : "/signup"}>
                  {tier.monthly === "Custom" ? "Contact Us" : "Get Started"}
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
