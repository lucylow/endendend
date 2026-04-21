import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useVertexSwarmStore } from "@/store/vertexSwarmStore";
import { usePeerMesh } from "@/hooks/usePeerMesh";

export function SwarmTaskPanel() {
  const view = useVertexSwarmStore((s) => s.view);
  const { reachability } = usePeerMesh();
  if (!view) {
    return (
      <Card className="border-border/60 bg-card/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Task allocation (mesh-aware)</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">No simulation view yet.</CardContent>
      </Card>
    );
  }
  const tasks = view.tasks.slice(0, 20);
  return (
    <Card className="border-border/60 bg-card/30">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Task allocation (mesh-aware)</CardTitle>
        <p className="text-[10px] text-muted-foreground">
          Bids use effective path quality toward the command anchor, including one-hop relay paths when the mesh is non-star.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[200px] px-4 pb-3 text-[10px] font-mono space-y-2">
          {tasks.map((t) => {
            const winnerPath = t.winnerNodeId ? reachability.get(t.winnerNodeId) : undefined;
            return (
              <div key={t.taskId} className="border-b border-border/20 pb-2">
                <div className="text-foreground flex flex-wrap gap-1 items-center">
                  <span>{t.taskId}</span>
                  <Badge variant="outline" className="text-[9px]">
                    {t.status}
                  </Badge>
                </div>
                <div className="text-muted-foreground">type {t.taskType}</div>
                {t.winnerNodeId && (
                  <div>
                    owner <span className="text-primary/90">{t.winnerNodeId}</span> · path q{" "}
                    {((winnerPath?.effectiveOperatorPath01 ?? 0) * 100).toFixed(0)}%
                    {winnerPath?.usesRelayToOperator ? " (relay)" : ""}
                  </div>
                )}
                {t.assignmentReason && <div className="text-emerald-200/80">rationale {t.assignmentReason}</div>}
                {t.fallbackNodeIds?.length ? (
                  <div className="text-muted-foreground">fallbacks {t.fallbackNodeIds.join(", ")}</div>
                ) : null}
              </div>
            );
          })}
          {!tasks.length && <div className="text-muted-foreground">No tasks yet.</div>}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
