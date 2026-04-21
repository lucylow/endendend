import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { lazy, Suspense, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CloudOff,
  Cpu,
  LayoutDashboard,
  LifeBuoy,
  Network,
  Radio,
  Scale,
  Share2,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FeatureCard } from "./FeatureCard";
import FeatureMatrixTable from "./FeatureMatrixTable";
import type { MatrixFeature } from "./types";

const Feature3DDemos = lazy(() => import("./Feature3DDemos"));

const matrixFeatures: MatrixFeature[] = [
  {
    title: "P2P consensus",
    description: "~50ms Vertex-class coordination for role votes and checkpoints.",
    free: true,
    pro: true,
    enterprise: true,
    icon: Network,
    gradient: "from-cyan-500 to-emerald-500",
    demo: "consensus",
  },
  {
    title: "Zero cloud egress",
    description: "FoxMQ mesh + edge compute — keep telemetry off the public internet.",
    free: true,
    pro: true,
    enterprise: true,
    icon: CloudOff,
    gradient: "from-emerald-500 to-violet-500",
    demo: "mesh",
  },
  {
    title: "Unlimited scale",
    description: "1K+ agents per swarm with operator dashboards that stay responsive.",
    free: false,
    pro: false,
    enterprise: true,
    icon: Scale,
    gradient: "from-purple-500 to-pink-500",
    demo: "scale",
  },
  {
    title: "Adaptive relay chains",
    description: "Dynamic relay insertion under lossy links and simulated partitions.",
    free: false,
    pro: true,
    enterprise: true,
    icon: Share2,
    gradient: "from-teal-500 to-cyan-400",
    demo: "relay",
  },
  {
    title: "Byzantine tolerance",
    description: "BFT-aware paths for malicious or faulty agent containment.",
    free: false,
    pro: true,
    enterprise: true,
    icon: Shield,
    gradient: "from-violet-500 to-fuchsia-500",
    demo: "bft",
  },
  {
    title: "Live FoxMQ telemetry",
    description: "Sub-second fan-out with backpressure-friendly operator views.",
    free: true,
    pro: true,
    enterprise: true,
    icon: Radio,
    gradient: "from-sky-500 to-indigo-500",
    demo: "telemetry",
  },
  {
    title: "Mission control UI",
    description: "Glass dashboard: simulation, agents, replay, and health in one shell.",
    free: true,
    pro: true,
    enterprise: true,
    icon: LayoutDashboard,
    gradient: "from-amber-500 to-orange-500",
    demo: "ui",
  },
  {
    title: "Edge hardware profiles",
    description: "Tuned presets for aerial vs ground agents and heterogeneous fleets.",
    free: false,
    pro: true,
    enterprise: true,
    icon: Cpu,
    gradient: "from-lime-500 to-emerald-600",
    demo: "edge",
  },
  {
    title: "SAR & scenario packs",
    description: "Search-rescue timelines, handoff viz, and scripted demos for investors.",
    free: false,
    pro: true,
    enterprise: true,
    icon: LifeBuoy,
    gradient: "from-rose-500 to-red-400",
    demo: "sar",
  },
];

const ease = [0.22, 1, 0.36, 1] as const;

function DemoSkeleton() {
  return (
    <div
      className={cn(
        "h-[240px] sm:h-[300px] lg:h-[340px] rounded-2xl border border-white/[0.08] bg-[#050508]",
        "flex items-center justify-center",
      )}
    >
      <div className="h-8 w-8 rounded-full border-2 border-teal-500/25 border-t-teal-400 animate-spin" />
    </div>
  );
}

export default function FeatureMatrix() {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollProgressRef = useRef(0);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.9", "end 0.15"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    scrollProgressRef.current = latest;
    const n = matrixFeatures.length;
    const idx = Math.min(Math.max(0, Math.floor(latest * n)), n - 1);
    setHighlightIndex(idx);
  });

  const yHero = useTransform(scrollYProgress, [0, 0.45], ["0%", "12%"]);
  const scaleDemos = useTransform(scrollYProgress, [0.15, 0.75], [0.92, 1]);
  const opacityTable = useTransform(scrollYProgress, [0.25, 0.72], [0.35, 1]);

  return (
    <section ref={sectionRef} className="relative min-h-[180vh] py-20 sm:py-28 px-4 sm:px-6 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-[hsl(220_22%_5%)] to-background pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.4] bg-grid pointer-events-none"
        aria-hidden
      />

      <motion.div style={{ y: yHero }} className="text-center max-w-5xl mx-auto mb-14 sm:mb-20 relative z-10">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease }}
          className="inline-block font-mono text-[10px] sm:text-xs text-amber-400/90 tracking-[0.22em] uppercase mb-4"
        >
          Feature matrix
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65, ease }}
          className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] px-2"
        >
          <span className="text-gradient-hero">Production swarm intelligence</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, delay: 0.06, ease }}
          className="mt-5 text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          Compare Free, Pro, and Enterprise. Scroll to reveal capabilities, live 3D formation, and pricing — built to
          move evaluators from curiosity to checkout.
        </motion.p>
      </motion.div>

      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-start relative z-10">
        <motion.div
          style={{ scale: scaleDemos }}
          className="space-y-6 sm:space-y-8 lg:sticky lg:top-28 lg:self-start will-change-transform"
        >
          {matrixFeatures.map((feature, i) => (
            <FeatureCard
              key={feature.title}
              feature={feature}
              index={i}
              active={highlightIndex === i}
              onActivate={() => setHighlightIndex(i)}
            />
          ))}

          <Suspense fallback={<DemoSkeleton />}>
            <Feature3DDemos scrollProgressRef={scrollProgressRef} highlightIndex={highlightIndex} />
          </Suspense>
        </motion.div>

        <motion.div style={{ opacity: opacityTable }} className="will-change-[opacity]">
          <FeatureMatrixTable features={matrixFeatures} />

          <motion.div
            className="mt-12 sm:mt-14 text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease }}
          >
            <Link to="/dashboard/billing">
              <Button
                size="lg"
                className={cn(
                  "group rounded-2xl h-12 sm:h-14 px-8 sm:px-10 font-semibold shadow-xl shadow-teal-500/10",
                  "glow-cyan border border-teal-400/20",
                )}
              >
                Choose your plan
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <p className="mt-4 text-xs text-muted-foreground font-mono tracking-wide">
              Annual toggle applies to list pricing · Enterprise invoicing available
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
