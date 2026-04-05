import { motion } from "framer-motion";
import { Shield, Radio, Zap, Users } from "lucide-react";

const proofs = [
  { icon: Radio, value: "0", label: "Cloud dependencies", color: "text-primary" },
  { icon: Users, value: "5–50", label: "Agent scale", color: "text-primary" },
  { icon: Zap, value: "<2s", label: "Chain recovery", color: "text-accent" },
  { icon: Shield, value: "BFT", label: "Consensus", color: "text-primary" },
];

export default function MissionProofStrip() {
  return (
    <div className="relative w-full border-y border-border/30 bg-card/20 backdrop-blur-xl overflow-hidden">
      <div className="absolute inset-0 bg-grid-fine opacity-40 pointer-events-none" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
          {proofs.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3.5 group"
            >
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/[0.06] border border-primary/10 group-hover:border-primary/25 group-hover:bg-primary/[0.1] transition-all duration-400">
                <p.icon className={`w-4.5 h-4.5 ${p.color} opacity-80`} />
              </div>
              <div>
                <div className="font-mono text-xl font-bold text-foreground tracking-tight leading-none">
                  {p.value}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 uppercase tracking-[0.14em]">
                  {p.label}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
