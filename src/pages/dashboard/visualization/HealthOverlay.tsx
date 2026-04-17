import { motion } from "framer-motion";
import { Activity, AlertTriangle, Radio, WifiOff, type LucideIcon } from "lucide-react";
import { useFleetHealthSummary } from "@/features/health/useRobotHealth";
import { cn } from "@/lib/utils";

export function HealthOverlay() {
  const s = useFleetHealthSummary();

  return (
    <motion.div
      className="pointer-events-none absolute left-4 top-24 z-[45] w-[min(100%,14rem)] sm:left-6 sm:top-28"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/90 px-3 py-3 shadow-xl backdrop-blur-xl">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">
          <Activity className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
          Fleet health
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Stat label="Avg score" value={`${s.avgScore.toFixed(0)}`} accent="text-cyan-300" />
          <Stat label="OK" value={String(s.healthy)} accent="text-emerald-400" />
          <Stat label="Warn" value={String(s.warning)} accent="text-amber-400" icon={AlertTriangle} />
          <Stat label="Degraded" value={String(s.degraded)} accent="text-orange-400" />
          <Stat label="Critical" value={String(s.critical)} accent="text-red-400" />
          <Stat label="Offline" value={String(s.offline)} accent="text-zinc-500" icon={WifiOff} />
        </div>
        {s.predictiveWarnings > 0 && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-200/90">
            <Radio className="h-3 w-3 shrink-0 text-amber-400" aria-hidden />
            <span>{s.predictiveWarnings} predictive warning{s.predictiveWarnings > 1 ? "s" : ""} (score 32–48)</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-lg bg-zinc-900/70 px-2 py-1.5">
      <div className="flex items-center gap-1 text-zinc-500">
        {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
        <span>{label}</span>
      </div>
      <div className={cn("font-mono text-sm font-semibold tabular-nums", accent)}>{value}</div>
    </div>
  );
}
