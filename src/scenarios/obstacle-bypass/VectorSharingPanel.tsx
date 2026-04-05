import { Radio } from "lucide-react";
import { useObstacleBypassStore } from "./obstacleBypassStore";

export default function VectorSharingPanel() {
  const n = useObstacleBypassStore((s) => s.vectorShareCount);
  const mode = useObstacleBypassStore((s) => s.mode);

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-950/15 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-blue-200">
        <Radio className="h-4 w-4" />
        FoxMQ obstacle vectors
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed">
        Each agent publishes a repulsion sample toward the pillar hull; the field averages peer hints for blended avoidance.
      </p>
      <div className="font-mono text-lg text-blue-300 tabular-nums">
        {mode === "swarm" ? `${n} live publishers` : "Idle (LF mode)"}
      </div>
    </div>
  );
}
