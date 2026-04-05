import { motion } from "framer-motion";

const data = [
  { depth: "0–20m", loss: "0%", latency: "10ms", status: "excellent", bar: 5 },
  { depth: "20–40m", loss: "10%", latency: "30ms", status: "good", bar: 20 },
  { depth: "40–60m", loss: "30%", latency: "80ms", status: "degraded", bar: 45 },
  { depth: "60–80m", loss: "60%", latency: "150ms", status: "critical", bar: 72 },
  { depth: "80–100m", loss: "90%", latency: "250ms", status: "blackout", bar: 95 },
];

const statusColors: Record<string, string> = {
  excellent: "bg-success",
  good: "bg-success/70",
  degraded: "bg-accent",
  critical: "bg-accent",
  blackout: "bg-destructive",
};

const statusTextColors: Record<string, string> = {
  excellent: "text-success",
  good: "text-success/80",
  degraded: "text-accent",
  critical: "text-accent",
  blackout: "text-destructive",
};

export default function NetworkDegradationTable() {
  return (
    <div className="rounded-xl border border-glow bg-card/50 overflow-hidden">
      <div className="grid grid-cols-4 gap-0 text-[10px] sm:text-xs font-mono font-semibold text-muted-foreground border-b border-border px-4 sm:px-5 py-3 tracking-wider">
        <span>DEPTH</span>
        <span>PACKET LOSS</span>
        <span>LATENCY</span>
        <span>SIGNAL</span>
      </div>
      {data.map((row, i) => (
        <motion.div
          key={row.depth}
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-4 gap-0 text-xs sm:text-sm font-mono px-4 sm:px-5 py-3.5 border-b border-border/30 last:border-0 items-center group hover:bg-muted/20 transition-colors"
        >
          <span className="text-foreground font-medium">{row.depth}</span>
          <span className={row.bar > 50 ? "text-accent font-semibold" : "text-foreground"}>{row.loss}</span>
          <span className={row.bar > 50 ? "text-accent font-semibold" : "text-foreground"}>{row.latency}</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${100 - row.bar}%` }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 + 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className={`h-full rounded-full ${statusColors[row.status]}`}
              />
            </div>
            <span className={`text-[10px] uppercase font-semibold ${statusTextColors[row.status]}`}>
              {row.status}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
