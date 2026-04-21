import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";

export function VertexReplayPanel({ view }: { view: VertexSwarmView | null }) {
  if (!view) return null;
  const tail = view.ledgerTail;
  return (
    <Card className="border-border/60 bg-card/30">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Ledger tail (proof-bearing)</CardTitle>
        <p className="text-[10px] text-muted-foreground font-mono">
          {tail.length} events · tick {view.tickCount}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[200px] px-4 pb-3 font-mono text-[10px] text-muted-foreground">
          <div className="space-y-1">
            {[...tail].reverse().map((e) => (
              <div key={e.eventHash} className="truncate border-b border-border/20 pb-1">
                <span className="text-foreground/90">{e.eventType}</span> · {e.actorId.slice(0, 12)}… ·{" "}
                {e.eventHash.slice(0, 10)}…
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
