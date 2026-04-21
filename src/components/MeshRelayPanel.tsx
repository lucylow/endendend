import { Badge } from "@/components/ui/badge";
import type { MeshSurvivalPublicView } from "@/mesh/types";

export function MeshRelayPanel({ mesh }: { mesh: MeshSurvivalPublicView | null }) {
  const plan = mesh?.relayPlan ?? [];
  if (!plan.length) return <p className="text-xs text-muted-foreground">No relay nominations.</p>;
  return (
    <div className="space-y-2">
      {plan.map((r) => (
        <div key={r.nodeId} className="rounded-md border border-border/40 bg-background/40 px-2 py-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-foreground">{r.nodeId}</span>
            <Badge variant="secondary" className="text-[9px]">
              {(r.score01 * 100).toFixed(0)}%
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">{r.reasons.join(" · ")}</p>
          <p className="text-[10px] text-muted-foreground/80 mt-0.5">
            hold {r.holdsPosition ? "yes" : "no"} · est. load {(r.estimatedLoad01 * 100).toFixed(0)}%
          </p>
        </div>
      ))}
    </div>
  );
}
