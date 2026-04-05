import { HeartPulse } from "lucide-react";
import { useRandomFailureStore } from "./randomFailureStore";

function StatusCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "emerald" | "amber" | "blue" | "gray";
}) {
  const ring =
    color === "emerald"
      ? "border-emerald-500/35 text-emerald-300"
      : color === "amber"
        ? "border-amber-500/35 text-amber-300"
        : color === "blue"
          ? "border-sky-500/35 text-sky-300"
          : "border-zinc-600 text-zinc-300";
  return (
    <div className={`rounded-lg border bg-zinc-900/50 px-3 py-2.5 text-center ${ring}`}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

export default function ResilienceMetrics() {
  const performanceUptime = useRandomFailureStore((s) => s.performanceUptime);
  const agentLossRate = useRandomFailureStore((s) => s.agentLossRate);
  const missionProgress = useRandomFailureStore((s) => s.missionProgress);
  const failuresHandled = useRandomFailureStore((s) => s.failuresHandled);
  const agents = useRandomFailureStore((s) => s.agents);
  const alive = agents.filter((a) => a.alive).length;
  const leaders = agents.filter((a) => a.alive && a.role === "leader").length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-500/40 bg-zinc-950/70 p-6 shadow-xl backdrop-blur-xl">
        <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-emerald-400">
          <HeartPulse className="h-6 w-6" />
          Mission resilience
        </h3>

        <div className="grid grid-cols-2 gap-8 text-center">
          <div>
            <div className="text-4xl font-black text-emerald-400">{performanceUptime.toFixed(1)}%</div>
            <div className="mt-1 text-sm text-zinc-400">Performance</div>
          </div>
          <div>
            <div className="text-4xl font-black text-orange-400">{agentLossRate.toFixed(0)}%</div>
            <div className="mt-1 text-sm text-zinc-400">Agent loss</div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/20 p-4 text-center">
          <div className="text-xl font-bold text-emerald-400">98.7% uptime @ 40% loss</div>
          <div className="mt-1 text-sm text-emerald-300">No human intervention</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-4 backdrop-blur-xl">
        <StatusCard label="Alive agents" value={`${alive}/10`} color="emerald" />
        <StatusCard label="Leaders active" value={`${leaders}`} color="amber" />
        <StatusCard label="Mission progress" value={`${missionProgress.toFixed(0)}%`} color="blue" />
        <StatusCard label="Failures handled" value={`${failuresHandled}`} color="gray" />
      </div>
    </div>
  );
}
