import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden pt-16">
      {/* Glow orbs */}
      <div className="pointer-events-none absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-accent/10 blur-[120px]" />

      <div className="container relative z-10 mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="mb-6 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            AI-Powered Sales Automation — Find to Close
          </span>
        </motion.div>

        <motion.h1
          className="mx-auto mb-6 max-w-4xl text-5xl font-bold leading-tight tracking-tight md:text-7xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          From first contact to{" "}
          <span className="gradient-text">signed contract.</span>
        </motion.h1>

        <motion.p
          className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Media Sync finds your ideal clients, writes personalised outreach across email and LinkedIn,
          handles every reply, makes AI sales calls, generates proposals, and tracks deals to close. Your AI sales team handles the entire pipeline.
        </motion.p>

        <motion.div
          className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Button size="lg" asChild className="gradient-primary border-0 px-8 text-base text-white shadow-lg glow-primary hover:opacity-90">
            <Link to="/signup">
              Start Your AI Sales Team
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="px-8 text-base">
            <Play className="mr-2 h-4 w-4" />
            Watch Demo
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
