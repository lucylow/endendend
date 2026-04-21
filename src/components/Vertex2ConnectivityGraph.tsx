import { ScrollArea } from "@/components/ui/scroll-area";
import type { MeshGraphView } from "@/vertex2/types";

export function Vertex2ConnectivityGraph({ graph }: { graph: MeshGraphView | null }) {
  if (!graph) return null;
  return (
    <ScrollArea className="h-[200px] text-[10px] font-mono">
      <div className="space-y-1 pr-3">
        <div className="text-muted-foreground">
          bridges: {graph.bridges.join(", ") || "—"} · isolated: {graph.isolated.join(", ") || "—"}
        </div>
        {graph.links.map((l) => (
          <div key={`${l.a}-${l.b}`} className="border-b border-border/20 py-1 flex justify-between gap-2">
            <span>
              {l.a} ↔ {l.b}
              {l.viaRelay ? ` via ${l.viaRelay}` : ""}
            </span>
            <span className="text-muted-foreground shrink-0">
              {(l.quality01 * 100).toFixed(0)}% · {l.latencyMs.toFixed(0)}ms · loss {(l.loss01 * 100).toFixed(0)}%
              {l.isBridge ? " · bridge" : ""}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
