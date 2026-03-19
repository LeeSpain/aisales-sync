import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import {
  Search, Mail, PhoneCall, FileText, Handshake, ArrowRight,
  Target, BarChart3, Lightbulb, Users, Shield, Zap, Check,
  Linkedin, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Pipeline stages ─── */
const stages = [
  {
    num: "01",
    title: "Find & Qualify Leads",
    icon: Search,
    gradient: "from-violet-500 to-indigo-500",
    glow: "violet",
    desc: "Your AI scours Google Maps, Apollo, LinkedIn, and business directories to discover prospects that match your ideal client profile. Every lead is visited, researched, and scored 1\u20135 before entering your pipeline.",
    features: [
      "Searches Google Places, Apollo, LinkedIn, and web directories",
      "Visits each prospect\u2019s website to understand their business",
      "Enriches contact data \u2014 email, phone, social profiles",
      "Scores leads 1\u20135 based on fit, size, and intent signals",
    ],
  },
  {
    num: "02",
    title: "Personalised Outreach",
    icon: Mail,
    gradient: "from-indigo-500 to-blue-500",
    glow: "indigo",
    desc: "The AI writes hyper-personalised messages for every lead across email, LinkedIn, and SMS. Each sequence adapts based on the prospect\u2019s industry, website content, and engagement signals \u2014 no templates, no spam.",
    features: [
      "AI-written emails tailored to each prospect\u2019s business",
      "LinkedIn connection requests with personalised notes",
      "Multi-step sequences with smart follow-up timing",
      "A/B testing of subject lines and messaging angles",
    ],
  },
  {
    num: "03",
    title: "AI Sales Calls",
    icon: PhoneCall,
    gradient: "from-blue-500 to-cyan-500",
    glow: "blue",
    desc: "When a lead shows interest, your AI can make briefed calls using your company knowledge. It handles objections, qualifies further, and books meetings directly into your calendar \u2014 all logged and recorded.",
    features: [
      "AI-briefed calls using your company profile and services",
      "Handles common objections with your selling points",
      "Books meetings directly into your calendar",
      "Full call transcripts and outcome logging",
    ],
  },
  {
    num: "04",
    title: "Proposal Generation",
    icon: FileText,
    gradient: "from-cyan-500 to-teal-500",
    glow: "cyan",
    desc: "Once a lead is qualified and interested, the AI generates branded proposals using your services, pricing, and knowledge base. Review and approve, or let the AI send automatically based on your preferences.",
    features: [
      "Auto-generates proposals from your company knowledge",
      "Uses your pricing, services, and selling points",
      "Approval workflow \u2014 review before sending or auto-send",
      "Tracks opens, views, and follow-up engagement",
    ],
  },
  {
    num: "05",
    title: "Close the Deal",
    icon: Handshake,
    gradient: "from-emerald-500 to-green-500",
    glow: "emerald",
    desc: "Your full deal pipeline in one place. Track every opportunity from first contact to signed contract. The AI handles follow-ups, contract nudges, and gives you a real-time revenue dashboard.",
    features: [
      "Visual deal pipeline with drag-and-drop stages",
      "Automated follow-ups for stalled deals",
      "Revenue forecasting and conversion analytics",
      "Full activity timeline for every prospect",
    ],
  },
];

/* ─── Feature grid items ─── */
const features = [
  { icon: Search, title: "AI Lead Discovery", desc: "Finds prospects across multiple data sources automatically" },
  { icon: Target, title: "Smart Lead Scoring", desc: "Scores every lead 1\u20135 based on fit and intent signals" },
  { icon: Mail, title: "Email Sequences", desc: "Multi-step personalised email campaigns on autopilot" },
  { icon: Linkedin, title: "LinkedIn Automation", desc: "Connection requests, DMs, and engagement sequences" },
  { icon: PhoneCall, title: "AI Sales Calls", desc: "Briefed cold calls that handle objections and book meetings" },
  { icon: FileText, title: "Proposal Generator", desc: "Branded proposals built from your company knowledge" },
  { icon: BarChart3, title: "Deal Pipeline", desc: "Track every opportunity from contact to signed contract" },
  { icon: Shield, title: "Analytics & Reports", desc: "Campaign performance, conversion rates, and revenue tracking" },
  { icon: Lightbulb, title: "AI Knowledge Base", desc: "Teach the AI your processes, pricing, and special instructions" },
];

/* ─── Stats ─── */
const stats = [
  { value: "500+", label: "Companies" },
  { value: "10x", label: "Pipeline Velocity" },
  { value: "<5 min", label: "Setup Time" },
  { value: "24/7", label: "AI Sales Team" },
];

const HowItWorksPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ═══ SECTION 1: Hero Banner ═══ */}
      <section className="relative overflow-hidden bg-[hsl(240,20%,4%)] pt-32 pb-24">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-[15%] top-[20%] h-[500px] w-[500px] rounded-full bg-violet-600/[0.06] blur-[160px]" />
          <div className="absolute right-[10%] top-[30%] h-[400px] w-[400px] rounded-full bg-cyan-500/[0.05] blur-[140px]" />
          <div className="absolute left-[50%] bottom-0 h-[300px] w-[300px] rounded-full bg-indigo-500/[0.04] blur-[120px]" />
        </div>

        <div className="container relative z-10 mx-auto px-6 text-center">
          <motion.span
            className="mb-6 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            From Setup to Signed Contracts
          </motion.span>

          <motion.h1
            className="mx-auto mb-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            How{" "}
            <span className="gradient-text">AI Sales Sync</span>{" "}
            Works
          </motion.h1>

          <motion.p
            className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Five stages. One AI. Your entire sales pipeline — from finding the right prospects
            to closing signed contracts — running on autopilot.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Button size="lg" asChild className="gradient-primary border-0 px-8 text-base text-white shadow-lg glow-primary hover:opacity-90">
              <Link to="/signup">
                Start Your Free Trial <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 2: 5-Stage Pipeline Timeline ═══ */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">The 5-Stage AI Pipeline</h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              Each stage is fully automated. Set it up once, and your AI handles everything from discovery to deal closure.
            </p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            {/* Vertical timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500/50 via-cyan-500/50 to-emerald-500/50 hidden md:block" />

            <div className="space-y-12">
              {stages.map((stage, i) => {
                const Icon = stage.icon;
                const isEven = i % 2 === 0;
                return (
                  <motion.div
                    key={stage.num}
                    className="relative"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-3.5 top-8 hidden md:flex">
                      <div className={cn(
                        "h-5 w-5 rounded-full border-2 border-background bg-gradient-to-br",
                        stage.gradient
                      )} />
                    </div>

                    {/* Card */}
                    <div className="md:ml-16 rounded-2xl border border-border bg-card p-4 md:p-8 transition-all hover:border-primary/30 hover:shadow-lg">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                        {/* Icon + number */}
                        <div className="shrink-0">
                          <div className={cn(
                            "flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg",
                            stage.gradient
                          )}>
                            <Icon className="h-7 w-7 text-white" />
                          </div>
                          <p className="mt-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">
                            Step {stage.num}
                          </p>
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                          <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                            {stage.desc}
                          </p>
                          <ul className="grid gap-2 sm:grid-cols-2">
                            {stage.features.map((f) => (
                              <li key={f} className="flex items-start gap-2 text-sm">
                                <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 3: What's Included Feature Grid ═══ */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Everything You Get</h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              Every tool your sales team needs — built in, automated, and powered by AI.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {features.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  key={feat.title}
                  className="group rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:-translate-y-1 hover:shadow-lg"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1 text-base font-semibold">{feat.title}</h3>
                  <p className="text-sm text-muted-foreground">{feat.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 4: Stats Bar ═══ */}
      <section className="border-t border-border bg-card/50 py-16">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <p className="text-3xl font-bold gradient-text sm:text-4xl">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 5: Bottom CTA ═══ */}
      <section className="py-24">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Ready to automate your sales?
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-muted-foreground">
              Start your 14-day free trial today. No credit card required. Set up in under 5 minutes.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" asChild className="gradient-primary border-0 px-8 text-base text-white shadow-lg glow-primary hover:opacity-90">
                <Link to="/signup">
                  Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="px-8 text-base">
                <Link to="/pricing">View Pricing</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HowItWorksPage;
