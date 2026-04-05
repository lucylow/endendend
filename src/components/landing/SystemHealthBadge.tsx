import { motion } from "framer-motion";
import { useSwarmStore } from "@/store/swarmStore";

export default function SystemHealthBadge() {
  const agents = useSwarmStore((s) => s.agents);
  const online = agents.filter((a) => a.status === "active").length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-full border border-border/30 bg-card/30 backdrop-blur-xl text-[11px] font-mono group hover:border-primary/20 transition-colors duration-300"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-50" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
      </span>
      <span className="text-muted-foreground">
        SIM <span className="text-foreground font-medium">{online}/{agents.length}</span> agents
      </span>
    </motion.div>
  );
}
