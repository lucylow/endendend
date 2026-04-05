import { Shield, Timer, Radar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePredatorEvasionStore } from "./predatorEvasionStore";

function SafetyStat({
  label,
  value,
  safe,
}: {
  label: string;
  value: string;
  safe?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-3 py-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${safe ? "text-emerald-400" : "text-zinc-200"}`}>{value}</div>
    </div>
  );
}

export default function EvasionMetrics() {
  const zeroCollisions = usePredatorEvasionStore((s) => s.zeroCollisions);
  const staticDelaySec = usePredatorEvasionStore((s) => s.staticDelaySec);
  const threatDistanceM = usePredatorEvasionStore((s) => s.threatDistanceM);
  const collisionRiskPct = usePredatorEvasionStore((s) => s.collisionRiskPct);
  const agentsSafe = usePredatorEvasionStore((s) => s.agentsSafe);
  const missionDelaySec = usePredatorEvasionStore((s) => s.missionDelaySec);
  const narrative = usePredatorEvasionStore((s) => s.narrative);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-red-500/35 bg-zinc-950/70 p-6 shadow-xl backdrop-blur-xl">
        <h3 className="mb-4 flex flex-wrap items-center gap-2 text-lg font-bold text-red-300">
          <Shield className="h-6 w-6 shrink-0" />
          Security envelope
          {zeroCollisions ? (
            <Badge className="bg-emerald-600/90 font-mono text-white">Zero hard collisions</Badge>
          ) : (
            <Badge variant="destructive" className="font-mono">
              Risk {collisionRiskPct}%
            </Badge>
          )}
        </h3>

        <div className="grid grid-cols-2 gap-6 text-center">
          <div>
            <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
              <Timer className="h-4 w-4 text-amber-400" />
              Mission delay
            </div>
            <div className="mt-2 text-3xl font-black text-amber-200">{missionDelaySec.toFixed(1)}s</div>
            <div className="mt-1 text-xs text-zinc-500">Scatter → reform narrative</div>
          </div>
          <div>
            <div className="text-sm text-zinc-500">Static baseline</div>
            <div className="mt-2 text-3xl font-black text-zinc-500">~{staticDelaySec}s</div>
            <div className="mt-1 text-xs text-zinc-500">Design comparison</div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400">
          <Radar className="h-4 w-4 shrink-0 text-sky-400" />
          <span className="font-mono text-zinc-300">Threat range {threatDistanceM} m</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-4 backdrop-blur-xl">
        <SafetyStat label="Collision risk" value={`${collisionRiskPct}%`} safe={collisionRiskPct === 0} />
        <SafetyStat label="Agents safe" value={agentsSafe} safe />
      </div>

      <p className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3 text-xs leading-relaxed text-zinc-400">{narrative}</p>
    </div>
  );
}
