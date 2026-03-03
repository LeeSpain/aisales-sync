import { motion } from "framer-motion";
import { MessageSquare, Target, Zap } from "lucide-react";

const steps = [
  {
    num: "01",
    title: "Tell the AI about your business",
    desc: "No forms. Just talk. The AI researches your website and builds your complete sales profile in minutes.",
    icon: MessageSquare,
  },
  {
    num: "02",
    title: "AI hunts and qualifies leads",
    desc: "Finds prospects, visits their websites, scores them 1-5 on fit, and throws away anything below 3.5.",
    icon: Target,
  },
  {
    num: "03",
    title: "Personalised outreach on autopilot",
    desc: "Every email references the prospect's specific business. AI handles replies, objections, and books calls.",
    icon: Zap,
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24">
      <div className="container mx-auto px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">How It Works</h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Three steps to autonomous sales. Set it up once, watch leads convert.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              className="group rounded-2xl border border-border bg-card p-8 transition-all hover:border-primary/40 hover:-translate-y-1 hover:shadow-lg"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <step.icon className="h-6 w-6" />
              </div>
              <span className="mb-2 block text-sm font-semibold text-primary">
                Step {step.num}
              </span>
              <h3 className="mb-3 text-xl font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
