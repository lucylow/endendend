import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { MeshSurvivalPublicView } from "@/mesh/types";

export function MeshReplayPanel({ mesh }: { mesh: MeshSurvivalPublicView | null }) {
  const entries = mesh?.replay ?? [];
  return (
    <ScrollArea className="h-[180px] text-[11px]">
      {entries.length === 0 && <p className="text-muted-foreground">Replay narrative fills as the mesh ledger grows.</p>}
      {entries.map((e, i) => (
        <div key={i} className="border-b border-border/20 py-1 flex flex-wrap gap-2 items-start">
          <Badge variant={e.severity === "critical" ? "destructive" : e.severity === "warn" ? "secondary" : "outline"} className="text-[9px] shrink-0">
            {e.severity}
          </Badge>
          <div>
            <div className="text-foreground font-medium">{e.label}</div>
            <div className="text-muted-foreground">{e.detail}</div>
          </div>
        </div>
      ))}
    </ScrollArea>
  );
}
