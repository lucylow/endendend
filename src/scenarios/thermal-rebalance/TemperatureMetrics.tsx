import { motion } from "framer-motion";
import { Snowflake } from "lucide-react";
import { useThermalRebalanceStore, TARGET_RECOVERY_S, thermalColor } from "./thermalRebalanceStore";

function TempGauge({ agentId }: { agentId: string }) {
  const agent = useThermalRebalanceStore((s) => s.agents.find((a) => a.id === agentId));
  const temp = agent?.temperature ?? 25;
  const pct = Math.min(100, ((temp - 20) / 80) * 100);
  const hex = thermalColor(temp);

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/80 p-3 shadow-inner">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-mono text-zinc-400">{agent?.name ?? agentId}</span>
        <span className="font-bold tabular-nums" style={{ color: hex }}>
          {temp.toFixed(1)}°C
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: hex }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        />
      </div>
    </div>
  );
}

export default function TemperatureMetrics() {
  const recoveryTime = useThermalRebalanceStore((s) => s.recoveryTime);
  const coolingSuccess = useThermalRebalanceStore((s) => s.coolingSuccess);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-500/30 bg-zinc-950/80 p-6 shadow-xl backdrop-blur-xl">
        <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-emerald-400">
          <Snowflake className="h-6 w-6" />
          Cooling recovery ({TARGET_RECOVERY_S}s target)
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <div className="text-3xl font-black tabular-nums text-emerald-400">{recoveryTime.toFixed(0)}s</div>
              <div className="text-sm text-zinc-400">Elapsed (since thermal emergency)</div>
            </div>
            <div>
              <div className="text-3xl font-black tabular-nums text-zinc-400">{TARGET_RECOVERY_S}s</div>
              <div className="text-sm text-zinc-400">Warehouse SLA target</div>
            </div>
          </div>

          {coolingSuccess ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-4 text-center">
              <div className="text-lg font-bold text-emerald-400">ALL AGENTS &lt; 60°C</div>
              <div className="mt-1 text-sm text-emerald-300/90">Formation cooled — exhaust shielded</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TempGauge agentId="rover-1" />
        <TempGauge agentId="rover-2" />
        <TempGauge agentId="rover-3" />
        <TempGauge agentId="rover-4" />
      </div>
    </div>
  );
}
