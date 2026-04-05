import { motion } from "framer-motion";
import { useSwarmStore } from "@/store/swarmStore";
import { useSwarmVisualization } from "@/features/swarm/useSwarmVisualization";
import { Activity, Battery, Radio, Users } from "lucide-react";

export default function TelemetryOverlay() {
  const { swarm, coordinationLatency, agentCount, avgBattery, criticalBattery } = useSwarmVisualization();
  const explorationProgress = useSwarmStore((s) => s.explorationProgress);
  const isRunning = useSwarmStore((s) => s.isRunning);

  const status = swarm.status;
  const statusColor =
    status === "coordinating" || status === "exploring"
      ? "bg-emerald-400"
      : status === "emergency"
        ? "bg-orange-500"
        : "bg-zinc-500";

  return (
    <motion.div
      className="pointer-events-none absolute left-4 top-20 z-40 max-w-sm rounded-2xl border border-zinc-800/90 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-xl sm:left-6 sm:top-24 sm:p-5"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-start gap-3 border-b border-zinc-800/80 pb-3">
        <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${statusColor} ${isRunning ? "animate-pulse" : ""}`} />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Swarm</p>
          <p className="text-sm font-semibold text-zinc-100">{swarm.name}</p>
          <p className="mt-0.5 text-xs capitalize text-zinc-400">{status.replace("-", " ")}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 px-2.5 py-2">
          <Users className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
          <div>
            <dt className="text-zinc-500">Agents</dt>
            <dd className="font-mono text-sm text-zinc-100">{agentCount}</dd>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 px-2.5 py-2">
          <Radio className="h-3.5 w-3.5 text-sky-400" aria-hidden />
          <div>
            <dt className="text-zinc-500">Latency</dt>
            <dd className="font-mono text-sm text-cyan-300">{coordinationLatency}ms</dd>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 px-2.5 py-2">
          <Battery className="h-3.5 w-3.5 text-amber-400" aria-hidden />
          <div>
            <dt className="text-zinc-500">Battery avg</dt>
            <dd className="font-mono text-sm text-zinc-100">{avgBattery.toFixed(0)}%</dd>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 px-2.5 py-2">
          <Activity className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
          <div>
            <dt className="text-zinc-500">Explored</dt>
            <dd className="font-mono text-sm text-emerald-300">{explorationProgress.toFixed(0)}%</dd>
          </div>
        </div>
      </dl>

      {criticalBattery > 0 && (
        <p className="mt-3 rounded-lg border border-orange-500/30 bg-orange-950/40 px-2.5 py-2 font-mono text-[11px] text-orange-200">
          {criticalBattery} agent{criticalBattery > 1 ? "s" : ""} below 20% battery
        </p>
      )}
    </motion.div>
  );
}
