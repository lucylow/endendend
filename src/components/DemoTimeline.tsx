import { motion } from "framer-motion";

const steps = [
  { time: "0:00", event: "Launch", desc: "5 drones deploy at tunnel entrance", icon: "🚀", accent: false },
  { time: "0:20", event: "Election", desc: "Front drone elected as Explorer, chain forms", icon: "🟢", accent: false },
  { time: "0:40", event: "Advance", desc: "Explorer pushes deeper, relays hold position", icon: "➡️", accent: false },
  { time: "1:00", event: "Degradation", desc: "Signal loss hits 30% at 40m depth", icon: "📉", accent: true },
  { time: "1:20", event: "Relay Insert", desc: "New relay promoted to maintain chain", icon: "🔵", accent: true },
  { time: "1:40", event: "Failure", desc: "Relay #2 killed — heartbeat lost", icon: "💀", accent: true },
  { time: "2:00", event: "Recovery", desc: "Standby drone auto-repairs the chain", icon: "🔄", accent: false },
  { time: "2:20", event: "Found!", desc: "Victim detected — message relayed to base", icon: "🎯", accent: false },
];

export default function DemoTimeline() {
  return (
    <div className="relative">
      {/* Vertical line with gradient */}
      <div className="absolute left-[72px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-border to-border/30" />

      <div className="space-y-0.5">
        {steps.map((step, i) => (
          <motion.div
            key={step.time}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-start gap-4 py-3.5 group"
          >
            <span className="font-mono text-xs text-muted-foreground w-10 pt-1 text-right shrink-0 group-hover:text-foreground transition-colors">
              {step.time}
            </span>
            <div className="relative z-10 w-7 h-7 rounded-full bg-card border-2 border-border flex items-center justify-center text-sm shrink-0 group-hover:border-primary/50 group-hover:shadow-[0_0_8px_hsl(185_80%_50%/0.2)] transition-all duration-300">
              {step.icon}
            </div>
            <div className="pt-0.5">
              <h4 className={`font-semibold text-sm ${step.accent ? "text-accent" : "text-foreground"}`}>
                {step.event}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
