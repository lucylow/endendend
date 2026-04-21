import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";

export function SwarmRolePanel({ view }: { view: VertexSwarmView | null }) {
  const rows = view?.roleHandoffs ?? [];
  return (
    <Card className="border-border/60 bg-card/25">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Role hand-offs</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[140px] px-4 pb-3 text-xs font-mono">
          {rows.length === 0 && <p className="text-muted-foreground">No hand-offs yet (mesh / mission driven).</p>}
          {rows.map((r, i) => (
            <div key={`${r.nodeId}-${r.atMs}-${i}`} className="border-b border-border/25 py-1 text-[10px]">
              <span className="text-muted-foreground">{new Date(r.atMs).toLocaleTimeString()}</span>{" "}
              <span className="text-foreground">{r.nodeId}</span> {r.fromRole}→{r.toRole}{" "}
              <span className="text-primary/80">{r.reason}</span>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
