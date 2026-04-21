import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";

export function SwarmEventFeed({ view }: { view: VertexSwarmView | null }) {
  const tail = view?.ledgerTail ?? [];
  return (
    <Card className="border-border/60 bg-card/25">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Ledger tail (proof stream)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[160px] px-4 pb-3 font-mono text-[10px] text-muted-foreground">
          {[...tail].reverse().map((e) => (
            <div key={e.eventHash} className="border-b border-border/20 py-1">
              <span className="text-foreground/90">{e.eventType}</span> · {e.actorId} ·{" "}
              <span className="text-primary/70">{e.eventHash.slice(0, 12)}…</span>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
