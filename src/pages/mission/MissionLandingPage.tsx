import { Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { SwarmHero3D } from "@/components/swarm-viz/SwarmHero3D";
import { Cpu, Radio, Shield } from "lucide-react";

const features = [
  { title: "P2P consensus", body: "Vertex-grade BFT without a cloud choke point.", icon: Cpu },
  { title: "Zero cloud", body: "FoxMQ + ROS2 mesh — operators own the data plane.", icon: Radio },
  { title: "1000+ agents", body: "Instanced viz + throttled state for 60fps control rooms.", icon: Shield },
];

export function MissionLandingPage() {
  const page = useRef(null);
  const { scrollYProgress } = useScroll({ target: page, offset: ["start start", "end end"] });
  const lift = useTransform(scrollYProgress, [0.15, 0.35], [0, -8]);

  return (
    <div ref={page} className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:pt-10">
      <section className="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400/90"
          >
            Track 2 · Vertex hackathon
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-4 text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl"
          >
            <span className="bg-gradient-to-r from-white via-cyan-100 to-emerald-300/90 bg-clip-text text-transparent">
              Tashi Swarm Control
            </span>
          </motion.h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-zinc-400 md:text-base">
            Mission-grade glass UI, real-time 3D chain health, and safety-first operators — built to win judges on first
            paint.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="glow-cyan px-8 font-semibold">
              <Link to="/swarm">Launch live demo</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/15 bg-white/5 text-zinc-100">
              <Link to="/features">Feature tour</Link>
            </Button>
          </div>
        </div>
        <SwarmHero3D />
      </section>

      <motion.section style={{ y: lift }} className="mt-20 grid gap-4 md:grid-cols-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: i * 0.08 }}
            className="card-lift rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-5 backdrop-blur-xl"
          >
            <f.icon className="h-8 w-8 text-emerald-400" aria-hidden />
            <h2 className="mt-3 text-lg font-semibold text-white">{f.title}</h2>
            <p className="mt-2 text-sm text-zinc-400">{f.body}</p>
          </motion.div>
        ))}
      </motion.section>

      <section className="mt-24 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 backdrop-blur-xl md:p-10">
        <h2 className="text-xl font-semibold text-white">60s demo reel</h2>
        <p className="mt-2 text-sm text-zinc-400">Swap in your YouTube ID for the finals deck.</p>
        <div className="mt-6 flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-black/50 text-center text-sm text-zinc-500">
          Drop a YouTube embed URL here for your 60s demo reel (placeholder).
        </div>
      </section>
    </div>
  );
}
