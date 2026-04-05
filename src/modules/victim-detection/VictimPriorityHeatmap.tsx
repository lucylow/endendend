import type { VictimPriority } from "./types";
import { cn } from "@/lib/utils";

export function VictimPriorityHeatmap({ priorities }: { priorities: VictimPriority[] }) {
  const max = Math.max(1e-6, ...priorities.map((p) => p.consensusScore));
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">Stake-weighted heat map</h3>
      <div className="space-y-2">
        {priorities.slice(0, 8).map((p) => {
          const w = (p.consensusScore / max) * 100;
          return (
            <div key={p.victimId} className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>
                  #{p.rank} {p.victimId}
                </span>
                <span>{(p.consensusScore * 100).toFixed(1)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r from-teal-600 to-violet-500 transition-all duration-500",
                  )}
                  style={{ width: `${w}%` }}
                />
              </div>
            </div>
          );
        })}
        {!priorities.length ? <p className="text-xs text-muted-foreground">No ranked victims yet.</p> : null}
      </div>
    </div>
  );
}
