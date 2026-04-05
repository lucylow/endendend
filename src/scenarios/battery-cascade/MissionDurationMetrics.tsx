import { Award } from "lucide-react";
import { useBatteryCascadeStore } from "./batteryCascadeStore";

export default function MissionDurationMetrics() {
  const tashiDuration = useBatteryCascadeStore((s) => s.scenarioStats.tashiDuration);
  const staticDuration = useBatteryCascadeStore((s) => s.scenarioStats.staticDuration);
  const missionExtension = useBatteryCascadeStore((s) => s.scenarioStats.missionExtension);
  const recovery = useBatteryCascadeStore((s) => s.scenarioStats.recoveryComplete);

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-zinc-900/60 p-6 backdrop-blur-md space-y-4">
      <h3 className="font-bold text-xl flex items-center gap-2 text-foreground">
        <Award className="h-5 w-5 text-emerald-400" />
        Mission extension proof
      </h3>

      <div className="grid grid-cols-2 gap-6 text-center">
        <div className="space-y-2">
          <div className="text-3xl font-black text-emerald-400 tabular-nums">
            {tashiDuration > 0 ? tashiDuration.toFixed(0) : "—"}s
          </div>
          <div className="text-sm text-zinc-400">Tashi swarm</div>
        </div>
        <div className="space-y-2">
          <div className="text-3xl font-black text-zinc-400 tabular-nums">{staticDuration.toFixed(0)}s</div>
          <div className="text-sm text-zinc-400">Centralized fallback</div>
        </div>
      </div>

      <div className="text-center">
        <div
          className={`text-2xl font-black tabular-nums ${recovery ? "text-emerald-400" : "text-zinc-500"}`}
        >
          {missionExtension > 0 ? `${missionExtension.toFixed(0)}% longer mission` : "Awaiting recovery"}
        </div>
        <div className="text-sm text-zinc-500 mt-1">Uninterrupted operations after cascade</div>
      </div>
    </div>
  );
}
