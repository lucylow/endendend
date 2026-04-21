import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Shield, Wifi, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

function AnimatedCounter({ end, suffix, label, decimals = 0 }: { end: number; suffix: string; label: string; decimals?: number }) {
  const [v, setV] = useState(0);

  useEffect(() => {
    setV(0);
    const start = performance.now();
    const dur = 1400;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - t) ** 4;
      setV(end * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end]);

  return (
    <div className="text-center group">
      <div className="relative">
        <span className="font-mono text-2xl sm:text-3xl font-bold text-primary tabular-nums block tracking-tight">
          {decimals > 0 ? v.toFixed(decimals) : Math.round(v)}
          <span className="text-primary/70">{suffix}</span>
        </span>
        <div className="absolute -inset-2 bg-primary/5 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
      <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-[0.15em] mt-1 block">{label}</span>
    </div>
  );
}

const trustSignals = [
  { icon: Wifi, label: "No cloud dependency" },
  { icon: Shield, label: "BFT consensus" },
  { icon: Zap, label: "Sub-second recovery" },
];

export default function HeroContent() {
  return (
    <div className="relative z-10 flex-1 flex flex-col justify-center px-5 sm:px-8 pt-20 pb-16 pointer-events-none">
      <div className="max-w-4xl mx-auto text-center pointer-events-auto">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease }}
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05, duration: 0.5 }}
            className="shimmer inline-flex items-center gap-2.5 font-mono text-[11px] sm:text-xs text-primary/90 border border-primary/20 bg-primary/[0.06] backdrop-blur-md rounded-full px-4 py-2 mb-8 tracking-[0.14em] uppercase"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Decentralized swarm control center
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.7, ease }}
            className="text-4xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-[-0.03em] leading-[1.02]"
          >
            <span className="text-gradient-hero block drop-shadow-sm">Mission control</span>
            <span className="mt-2 sm:mt-3 block text-2xl sm:text-4xl md:text-5xl font-semibold text-gradient-hero-sub tracking-[-0.02em]">
              when the cloud disappears
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.24, duration: 0.6 }}
            className="mt-7 sm:mt-9 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-[1.7]"
          >
            Coordinate search-and-rescue robot swarms in blackout environments.
            Peer-to-peer consensus, self-healing relay chains, and live 3D telemetry — no central server required.
          </motion.p>

          {/* Trust signals */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-7 flex flex-wrap justify-center gap-5 sm:gap-8"
          >
            {trustSignals.map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground/80 hover:text-muted-foreground transition-colors">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/[0.08] border border-primary/10">
                  <s.icon className="h-3 w-3 text-primary/80" />
                </div>
                <span>{s.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.55, ease }}
          className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mt-10 sm:mt-14"
        >
          <Link to="/dashboard/simulation">
            <Button
              size="lg"
              className={cn(
                "w-full sm:w-auto h-13 sm:h-14 px-9 sm:px-11 rounded-2xl text-base font-semibold",
                "glow-cyan-intense shadow-lg shadow-primary/10 border border-primary/20",
                "hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300",
              )}
            >
              Launch live demo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link to="/docs">
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto h-13 sm:h-14 px-9 sm:px-11 rounded-2xl text-base font-semibold border-border/60 bg-secondary/20 backdrop-blur-md hover:bg-secondary/40 hover:border-primary/15 transition-all duration-300"
            >
              <Play className="w-4 h-4 mr-2 opacity-80" />
              Read architecture
            </Button>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="mt-14 sm:mt-16 flex flex-wrap justify-center items-center gap-8 sm:gap-14"
        >
          <AnimatedCounter end={46} suffix="ms" label="Consensus latency" />
          <div className="hidden sm:block w-px h-8 bg-border/40" />
          <AnimatedCounter end={919} suffix="+" label="Agents scaled" />
          <div className="hidden sm:block w-px h-8 bg-border/40" />
          <AnimatedCounter end={91.8} suffix="%" label="Target uptime" decimals={1} />
        </motion.div>

      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="mt-auto pt-8 flex justify-center pointer-events-none"
        aria-hidden
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-6 h-10 rounded-full border-2 border-muted-foreground/20 flex justify-center pt-2"
        >
          <div className="w-1 h-2 rounded-full bg-muted-foreground/40" />
        </motion.div>
      </motion.div>
    </div>
  );
}
