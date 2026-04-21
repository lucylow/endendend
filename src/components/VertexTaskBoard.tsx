import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";

export function VertexTaskBoard({ view }: { view: VertexSwarmView | null }) {
  if (!view) return null;
  const tasks = view.tasks;
  return (
    <Card className="border-border/60 bg-card/30">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Task board</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[220px] px-4 pb-3">
          <div className="space-y-2">
            {tasks.length === 0 && <p className="text-xs text-muted-foreground">No tasks yet.</p>}
            {tasks.map((t) => (
              <div
                key={t.taskId}
                className="rounded-lg border border-border/50 bg-background/40 p-2 text-xs space-y-1"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-[10px] truncate">{t.taskId}</span>
                  <Badge variant="outline" className="text-[9px] shrink-0">
                    {t.status}
                  </Badge>
                </div>
                <div className="text-muted-foreground">{t.taskType}</div>
                {t.winnerNodeId && (
                  <div className="text-primary text-[10px]">Winner: {t.winnerNodeId}</div>
                )}
                {t.assignmentReason && (
                  <div className="text-[10px] text-muted-foreground border-t border-border/30 pt-1">
                    Why: {t.assignmentReason}
                  </div>
                )}
                {t.bids.filter((b) => b.status === "submitted" || b.score != null).length > 0 && (
                  <div className="text-[10px] space-y-0.5 pt-1 border-t border-border/30">
                    {t.bids
                      .filter((b) => b.score != null)
                      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                      .slice(0, 3)
                      .map((b) => (
                        <div key={b.nodeId} className="font-mono truncate">
                          {b.nodeId}: {(b.score ?? 0).toFixed(2)} — {b.scoreReasons[0] ?? "—"}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
