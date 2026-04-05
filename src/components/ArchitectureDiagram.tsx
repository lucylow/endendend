import { motion } from "framer-motion";

const layers = [
  {
    label: "Discovery Layer",
    desc: "mDNS-like peer discovery via UDP broadcast",
    icon: "📡",
    color: "border-primary/40 bg-primary/5",
    tag: "Layer 1",
  },
  {
    label: "State Sync",
    desc: "Replicated JSON state across all nodes",
    icon: "🔄",
    color: "border-primary/30 bg-primary/5",
    tag: "Layer 2",
  },
  {
    label: "Role Negotiation",
    desc: "Decentralized election: Explorer → Relay → Standby",
    icon: "🎯",
    color: "border-accent/30 bg-accent/5",
    tag: "Layer 3",
  },
  {
    label: "Message Relay",
    desc: "Store-and-forward P2P chain with TTL",
    icon: "⚡",
    color: "border-accent/40 bg-accent/5",
    tag: "Layer 4",
  },
];

export default function ArchitectureDiagram() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {layers.map((layer, i) => (
        <motion.div
          key={layer.label}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          className={`rounded-xl border p-5 ${layer.color} card-hover group`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl group-hover:scale-110 transition-transform duration-300">{layer.icon}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground">{layer.label}</h4>
                <span className="font-mono text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{layer.tag}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{layer.desc}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
