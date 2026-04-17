import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import RelayChainDemo from "@/components/RelayChainDemo";
import NetworkDegradationTable from "@/components/NetworkDegradationTable";
import ArchitectureDiagram from "@/components/ArchitectureDiagram";
import DemoTimeline from "@/components/DemoTimeline";
import RoleCard from "@/components/RoleCard";
import CodeSection from "@/components/CodeSection";
import HeroSwarm from "@/components/hero/HeroSwarm";

function useActiveSection() {
  const [active, setActive] = useState("");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    let observer: IntersectionObserver;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) setActive(entry.target.id);
          });
        },
        { rootMargin: "-40% 0px -55% 0px" }
      );
    } catch (e) {
      if (import.meta.env.DEV) console.warn("[Index] IntersectionObserver unavailable", e);
      return;
    }
    document.querySelectorAll("section[id]").forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);
  return active;
}

const navLinks = [
  { href: "#demo", label: "Demo" },
  { href: "#roles", label: "Roles" },
  { href: "#architecture", label: "Architecture" },
  { href: "#network", label: "Network" },
  { href: "#timeline", label: "Timeline" },
  { href: "#code", label: "Code" },
];

export default function Index() {
  const activeSection = useActiveSection();

  return (
    <div className="min-h-screen bg-background bg-grid scan-line relative">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 glass-landing-nav">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <span className="text-primary text-sm font-bold">◆</span>
            </div>
            <span className="font-semibold text-foreground text-sm sm:text-base tracking-tight">Dynamic Relay Chain</span>
          </div>
          <div className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
                  activeSection === link.href.slice(1)
                    ? "text-primary bg-primary/10 font-medium shadow-[0_0_12px_hsl(185_80%_50%/0.15)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Link
              to="/"
              className="font-mono text-[10px] text-primary hover:underline underline-offset-4"
            >
              Tashi Control Center
            </Link>
            <span className="font-mono text-[10px] sm:text-xs text-muted-foreground border border-primary/20 bg-primary/5 rounded-md px-2 py-1">
              Vertex Swarm 2026
            </span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 sm:pt-28 pb-20 sm:pb-28 px-6 overflow-hidden min-h-[85vh] flex items-center">
        {/* 3D Swarm Background */}
        <div className="absolute inset-0 z-0">
          <HeroSwarm className="h-full w-full opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/50 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-background/40" />
        </div>
        <div className="hero-glow top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="hero-glow bottom-0 right-1/4 opacity-40" style={{ animationDelay: "3s" }} />
        <div className="max-w-5xl mx-auto text-center relative z-10 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="inline-flex items-center gap-2 font-mono text-[10px] sm:text-xs text-accent border border-accent/30 bg-accent/10 rounded-full px-4 py-1.5 mb-8 tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              SEARCH & RESCUE SWARMS
            </span>
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-bold tracking-tighter leading-[1.02] text-foreground">
              <span className="text-gradient-hero block mb-2">BLACKOUT</span>
              The Dynamic{" "}
              <span className="text-gradient-hero">Relay Chain</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground mt-7 max-w-2xl mx-auto leading-relaxed">
              Mission control when the cloud disappears. Drones self-organize 
              into a communication chain — no central orchestrator, no cloud, no signal required.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row justify-center gap-3 mt-12"
          >
            <a
              href="#demo"
              className="group px-7 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all glow-cyan inline-flex items-center justify-center gap-2 hover:shadow-[0_0_30px_hsl(185_80%_50%/0.4)]"
            >
              Run Live Demo
              <span className="group-hover:translate-y-0.5 transition-transform">↓</span>
            </a>
            <a
              href="#architecture"
              className="px-7 py-3.5 rounded-xl border border-border/60 text-foreground font-semibold text-sm hover:bg-secondary hover:border-primary/30 transition-all inline-flex items-center justify-center backdrop-blur-sm"
            >
              View Architecture
            </a>
          </motion.div>

          {/* Floating stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.6 }}
            className="flex justify-center gap-3 sm:gap-4 mt-16"
          >
            {[
              { value: "5+", label: "Drones", icon: "⬡" },
              { value: "<2s", label: "Recovery", icon: "⚡" },
              { value: "90%", label: "Loss Tolerance", icon: "◈" },
              { value: "0", label: "Central Nodes", icon: "⊘" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.85 + i * 0.08 }}
                className="glass-stat rounded-xl px-4 sm:px-5 py-3 sm:py-4 text-center min-w-[80px] sm:min-w-[100px]"
              >
                <div className="font-mono text-lg sm:text-2xl font-bold text-primary tracking-tight">{stat.value}</div>
                <div className="text-[9px] sm:text-[10px] text-muted-foreground mt-1 tracking-wider uppercase">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <div className="section-divider max-w-5xl mx-auto" />

      {/* Interactive Demo */}
      <section id="demo" className="py-20 sm:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            label="INTERACTIVE DEMO"
            title="Watch the Swarm Self-Organize"
            desc="Drones enter a tunnel, elect a leader, form relay chains, survive failures, and relay critical data — all autonomously."
          />
          <div className="glass-card rounded-2xl p-1">
            <RelayChainDemo />
          </div>
        </div>
      </section>

      <div className="section-divider max-w-5xl mx-auto" />

      {/* Roles */}
      <section id="roles" className="py-20 sm:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeader label="ROLES" title="Decentralized Role Assignment" desc="Each drone dynamically assumes one of three roles based on network conditions and position." />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <RoleCard
              icon="🟢"
              title="Explorer"
              description="Pushes forward into unknown territory, collecting sensor data and searching for victims. Only one active at the swarm front."
              color="border-primary/20 glass-card"
              delay={0}
            />
            <RoleCard
              icon="🔵"
              title="Relay"
              description="Halts movement and acts as a store-and-forward node, bridging communication gaps between the explorer and base."
              color="border-primary/15 glass-card"
              delay={0.1}
            />
            <RoleCard
              icon="⚫"
              title="Standby"
              description="Unassigned drone ready to be promoted. Automatically takes over when a relay fails or signal degrades."
              color="border-border/50 glass-card"
              delay={0.2}
            />
          </div>
        </div>
      </section>

      <div className="section-divider max-w-5xl mx-auto" />

      {/* Architecture */}
      <section id="architecture" className="py-20 sm:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeader label="ARCHITECTURE" title="Communication Layers" desc="Four-layer stack built on Vertex P2P mesh — zero cloud dependencies." />
          <ArchitectureDiagram />

          {/* State JSON */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-8 rounded-2xl glass-card p-6 card-hover"
          >
            <h4 className="font-mono text-xs text-primary/70 mb-4 tracking-[0.2em]">REPLICATED NODE STATE</h4>
            <pre className="font-mono text-xs text-foreground/80 leading-relaxed overflow-x-auto">
{`{
  "drone_id": "drone_1",
  "role": "explorer",
  "position": { "x": 12.3, "y": 0.0, "z": 4.5 },
  "depth": 45.2,
  "last_heartbeat": 1678901234,
  "relay_chain": ["drone_1", "drone_3", "drone_5", "base"]
}`}
            </pre>
          </motion.div>
        </div>
      </section>

      <div className="section-divider max-w-5xl mx-auto" />

      {/* Network Degradation */}
      <section id="network" className="py-20 sm:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            label="NETWORK MODEL"
            title="Depth-Based Signal Degradation"
            desc="Signal strength degrades with tunnel depth. The relay chain adapts dynamically to maintain connectivity."
          />
          <NetworkDegradationTable />
        </div>
      </section>

      <div className="section-divider max-w-5xl mx-auto" />

      {/* Demo Timeline */}
      <section id="timeline" className="py-20 sm:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeader label="DEMO SCRIPT" title="3-Minute Demo Walkthrough" desc="A scripted demonstration showcasing every capability of the relay chain system." />
          <div className="max-w-lg">
            <DemoTimeline />
          </div>
        </div>
      </section>

      <div className="section-divider max-w-5xl mx-auto" />

      {/* Code */}
      <section id="code" className="py-20 sm:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeader label="FULL SOURCE CODE" title="Backend & Frontend Implementation" desc="Complete Python backend with Vertex P2P wrapper, chain manager, and network emulator — plus a real-time HTML/JS dashboard with WebSocket-driven visualization." />
          <CodeSection />
        </div>
      </section>

      <div className="section-divider max-w-5xl mx-auto" />

      {/* Judging Criteria */}
      <section className="py-20 sm:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeader label="CRITERIA" title="Why This Wins" desc="Direct alignment with Vertex Swarm Challenge 2026 judging criteria." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              { title: "Mesh Survival", desc: "Operates under 90% packet loss using dynamic relay insertion", metric: "90%", accent: "from-primary/20 to-primary/5" },
              { title: "Decentralized Logic", desc: "Zero central controller — roles negotiated via Vertex P2P", metric: "0", accent: "from-primary/15 to-primary/5" },
              { title: "Robustness", desc: "Auto-insertion + failure recovery in <2s", metric: "<2s", accent: "from-accent/15 to-accent/5" },
              { title: "Developer Clarity", desc: "One-click launch.sh reproduces the full demo", metric: "1×", accent: "from-success/15 to-success/5" },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl glass-card p-6 flex gap-5 card-hover group"
              >
                <div className={`font-mono text-xl font-bold text-primary shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br ${item.accent} border border-primary/15 flex items-center justify-center group-hover:shadow-[0_0_20px_hsl(185_80%_50%/0.15)] transition-shadow`}>
                  {item.metric}
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-lg">{item.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-12 px-6 bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
              <span className="text-primary text-xs">◆</span>
            </div>
            <span className="font-semibold text-foreground text-sm">Dynamic Relay Chain</span>
            <span className="text-muted-foreground text-sm">— Vertex Swarm Challenge 2026</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">Track 2: Search & Rescue Swarms</span>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({ label, title, desc }: { label: string; title: string; desc: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ ease: [0.22, 1, 0.36, 1] }}
      className="mb-14"
    >
      <span className="inline-flex items-center gap-2 font-mono text-[10px] sm:text-xs text-primary/70 tracking-[0.25em] uppercase">
        <span className="w-8 h-px bg-primary/40" />
        {label}
      </span>
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mt-3 leading-tight tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-4 max-w-2xl leading-relaxed text-base sm:text-lg">{desc}</p>
    </motion.div>
  );
}
