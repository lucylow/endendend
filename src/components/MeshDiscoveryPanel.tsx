import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { MeshSurvivalPublicView } from "@/mesh/types";

export function MeshDiscoveryPanel({ mesh }: { mesh: MeshSurvivalPublicView | null }) {
  const rows = mesh?.discovery.entries ?? [];
  return (
    <ScrollArea className="h-[200px] text-[11px] font-mono">
      {rows.length === 0 && <p className="text-muted-foreground px-1">No discovery sightings yet — run the sim under stress to populate.</p>}
      {rows.slice(-48).map((r, i) => (
        <div key={`${r.observerId}-${r.targetId}-${i}`} className="flex flex-wrap items-center gap-2 border-b border-border/25 py-1">
          <span className="text-foreground">{r.observerId}</span>
          <span className="text-muted-foreground">→</span>
          <span>{r.targetId}</span>
          <Badge variant="outline" className="text-[9px] h-5">
            {r.state}
          </Badge>
          <span className="text-muted-foreground">n={r.sightings}</span>
          {r.viaRelay && <span className="text-primary/80">relay {r.viaRelay}</span>}
        </div>
      ))}
    </ScrollArea>
  );
}
