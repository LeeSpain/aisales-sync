import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import {
  ArrowRight,
  Play,
  Search,
  Mail,
  PhoneCall,
  FileText,
  Handshake,
  ChevronDown,
} from "lucide-react";
import { useRef, type MouseEvent as ReactMouseEvent } from "react";

/* ─── Pipeline stage definitions ─── */
const stages = [
  { icon: Search, label: "Find", sub: "Discover leads", gradient: "from-violet-500 to-indigo-500", glow: "#7c3aed" },
  { icon: Mail, label: "Outreach", sub: "Send messages", gradient: "from-indigo-500 to-blue-500", glow: "#6366f1" },
  { icon: PhoneCall, label: "Calls", sub: "AI conversations", gradient: "from-blue-500 to-cyan-500", glow: "#3b82f6" },
  { icon: FileText, label: "Proposals", sub: "Generate docs", gradient: "from-cyan-500 to-teal-500", glow: "#06b6d4" },
  { icon: Handshake, label: "Close", sub: "Win the deal", gradient: "from-emerald-500 to-green-500", glow: "#10b981" },
];

/*
 * Card positions (px) inside the 500×580 scene.
 * FLOW: Find at TOP → Close at BOTTOM, zigzagging left-right.
 */
const cardPositions = [
  { x: 195, y: 10 },   // 1. Find — top center
  { x: 340, y: 125 },  // 2. Outreach — right
  { x: 120, y: 240 },  // 3. Calls — left
  { x: 330, y: 345 },  // 4. Proposals — right
  { x: 185, y: 460 },  // 5. Close — bottom center
];

const CARD_W = 110;
const CARD_H = 110;
const SCENE_W = 500;
const SCENE_H = 580;

/* ─── Build cubic bezier connecting card centers ─── */
function buildPath(fromIdx: number, toIdx: number): string {
  const f = cardPositions[fromIdx];
  const t = cardPositions[toIdx];
  const fx = f.x + CARD_W / 2;
  const fy = f.y + CARD_H / 2;
  const tx = t.x + CARD_W / 2;
  const ty = t.y + CARD_H / 2;
  const my = (fy + ty) / 2;
  return `M ${fx} ${fy} C ${fx} ${my}, ${tx} ${my}, ${tx} ${ty}`;
}

const connections = [
  { path: buildPath(0, 1), colors: ["#7c3aed", "#6366f1"] },
  { path: buildPath(1, 2), colors: ["#6366f1", "#3b82f6"] },
  { path: buildPath(2, 3), colors: ["#3b82f6", "#06b6d4"] },
  { path: buildPath(3, 4), colors: ["#06b6d4", "#10b981"] },
];

/* ─── Floating particles ─── */
const particles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: `${4 + Math.random() * 92}%`,
  top: `${4 + Math.random() * 92}%`,
  size: 1.5 + Math.random() * 2.5,
  delay: Math.random() * 6,
  dur: 3 + Math.random() * 4,
}));

/* ═══════════════════════════════════════════════
   3D Pipeline Visualization Component
   ═══════════════════════════════════════════════ */
const Pipeline3D = () => {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [14, -14]), { stiffness: 50, damping: 16 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-14, 14]), { stiffness: 50, damping: 16 });

  const onMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { mx.set(0); my.set(0); };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      style={{ perspective: "1100px" }}
    >
      {/* Orbital rings — hidden on small screens */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none hidden sm:flex">
        <div
          className="w-[300px] h-[300px] rounded-full border border-white/[0.04]"
          style={{ animation: "orbit 22s linear infinite", transform: "rotateX(65deg)" }}
        />
        <div
          className="absolute w-[420px] h-[420px] rounded-full border border-white/[0.03]"
          style={{ animation: "orbit 32s linear infinite reverse", transform: "rotateX(65deg)" }}
        />
        <div
          className="absolute w-[540px] h-[540px] rounded-full border border-white/[0.02]"
          style={{ animation: "orbit 40s linear infinite", transform: "rotateX(65deg)" }}
        />
      </div>

      {/* Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-blue-400/30 pointer-events-none"
          style={{
            left: p.left, top: p.top,
            width: p.size, height: p.size,
            animation: `particle-drift ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}

      {/* 3D motion container — scales down on small screens */}
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="relative origin-center scale-[0.6] sm:scale-75 md:scale-90 lg:scale-100"
      >
        {/* Shared coordinate scene */}
        <div className="relative" style={{ width: SCENE_W, height: SCENE_H }}>

          {/* ── Connection SVG ── */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={SCENE_W}
            height={SCENE_H}
            viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
            fill="none"
          >
            <defs>
              {connections.map((c, i) => (
                <linearGradient key={`lg-${i}`} id={`lg-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={c.colors[0]} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={c.colors[1]} stopOpacity="0.8" />
                </linearGradient>
              ))}
              <filter id="path-glow">
                <feGaussianBlur stdDeviation="5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {connections.map((c, i) => (
              <g key={i}>
                {/* Outer glow */}
                <path
                  d={c.path} stroke={`url(#lg-${i})`} strokeWidth="8"
                  strokeLinecap="round" fill="none" opacity="0.15" filter="url(#path-glow)"
                />
                {/* Core line */}
                <path
                  d={c.path} stroke={`url(#lg-${i})`} strokeWidth="2.5"
                  strokeLinecap="round" strokeDasharray="10 6" fill="none"
                  style={{ animation: `dash-flow 2s linear infinite`, animationDelay: `${i * 0.4}s` }}
                />
                {/* Primary traveling dot */}
                <circle r="4" fill={c.colors[0]} opacity="0.9">
                  <animateMotion dur={`${2.8 + i * 0.2}s`} repeatCount="indefinite" path={c.path} />
                </circle>
                {/* Secondary trailing dot */}
                <circle r="2.5" fill={c.colors[1]} opacity="0.5">
                  <animateMotion dur={`${2.8 + i * 0.2}s`} repeatCount="indefinite" path={c.path} begin={`${1.4}s`} />
                </circle>
              </g>
            ))}
          </svg>

          {/* ── Pipeline stage cards ── */}
          {stages.map((stage, i) => {
            const pos = cardPositions[i];
            const Icon = stage.icon;
            return (
              <motion.div
                key={stage.label}
                className="absolute group"
                style={{
                  left: pos.x, top: pos.y,
                  width: CARD_W, height: CARD_H,
                  transformStyle: "preserve-3d",
                  transform: "translateZ(30px)",
                  animation: `hero-float ${3.2 + i * 0.4}s ease-in-out ${i * 0.25}s infinite`,
                }}
                initial={{ opacity: 0, scale: 0.3, y: -15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.2 + i * 0.12, type: "spring", stiffness: 110 }}
                whileHover={{ scale: 1.12 }}
              >
                {/* Hover glow */}
                <div
                  className="absolute -inset-4 rounded-3xl opacity-0 group-hover:opacity-50 transition-opacity duration-500 blur-2xl"
                  style={{ background: stage.glow }}
                />
                {/* Card body */}
                <div className="relative w-full h-full rounded-2xl glass-card flex flex-col items-center justify-center gap-1 shadow-2xl">
                  {/* Scan line */}
                  <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                    <div
                      className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      style={{ animation: "scan-line 5s ease-in-out infinite", animationDelay: `${i * 1}s` }}
                    />
                  </div>
                  {/* Icon */}
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${stage.gradient} shadow-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  {/* Label */}
                  <span className="text-[11px] font-bold text-white/95 tracking-wide uppercase mt-0.5">
                    {stage.label}
                  </span>
                  {/* Subtitle */}
                  <span className="text-[9px] text-white/40 font-medium">
                    {stage.sub}
                  </span>
                </div>
                {/* Step badge */}
                <div className="absolute -top-2 -right-2 w-5.5 h-5.5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-[9px] font-bold text-white/80">{i + 1}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

/* ═══════════════════════════════════════════════
   Hero Section
   ═══════════════════════════════════════════════ */
const Hero = () => {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[hsl(240,20%,4%)]">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 h-[60%] hero-grid-floor" />
        <div className="pointer-events-none absolute left-[10%] top-[15%] h-[600px] w-[600px] rounded-full bg-violet-600/[0.06] blur-[160px]" />
        <div className="pointer-events-none absolute right-[5%] top-[25%] h-[500px] w-[500px] rounded-full bg-cyan-500/[0.05] blur-[140px]" />
        <div className="pointer-events-none absolute left-[40%] bottom-[5%] h-[400px] w-[400px] rounded-full bg-indigo-500/[0.04] blur-[120px]" />
      </div>

      <div className="container relative z-10 mx-auto flex min-h-screen items-center px-6 pt-20 pb-12">
        <div className="grid w-full gap-8 lg:grid-cols-2 lg:gap-4 items-center">
          {/* Left — Copy */}
          <div className="flex flex-col items-start text-left">
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
              className="mb-6 max-w-xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              From first contact to{" "}
              <span className="gradient-text">signed contract.</span>
            </motion.h1>

            <motion.p
              className="mb-10 max-w-lg text-base text-muted-foreground sm:text-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              AI Sales Sync finds your ideal clients, writes personalised outreach
              across email and LinkedIn, handles every reply, makes AI sales
              calls, generates proposals, and tracks deals to close.
            </motion.p>

            <motion.div
              className="flex flex-col gap-4 sm:flex-row"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Button
                size="lg"
                asChild
                className="gradient-primary border-0 px-8 text-base text-white shadow-lg glow-primary hover:opacity-90"
              >
                <Link to="/signup">
                  Start Your AI Sales Team
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 bg-white/5 px-8 text-base text-white hover:bg-white/10 hover:text-white"
              >
                <Play className="mr-2 h-4 w-4" />
                Watch Demo
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              className="mt-12 flex flex-wrap items-center gap-6 text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              {[
                { value: "500+", label: "Companies" },
                { value: "10x", label: "Pipeline Velocity" },
                { value: "<5 min", label: "Setup Time" },
              ].map((stat, i) => (
                <div key={stat.label} className="flex items-center gap-2">
                  {i > 0 && <div className="hidden sm:block h-4 w-px bg-white/10 mr-4" />}
                  <span className="text-lg font-bold text-white">{stat.value}</span>
                  <span className="text-white/50">{stat.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — 3D Pipeline */}
          <motion.div
            className="relative h-[360px] sm:h-[460px] md:h-[520px] lg:h-[600px] flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <Pipeline3D />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
