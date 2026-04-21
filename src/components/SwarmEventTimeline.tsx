import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useSwarmRuntime } from "@/hooks/useSwarmRuntime";

const KIND_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  task: "default",
  target: "destructive",
  role: "secondary",
  mesh: "outline",
  map: "outline",
  ledger: "outline",
  peer_signal: "secondary",
  tick: "outline",
};

export function SwarmEventTimeline() {
  const { runtimeEvents } = useSwarmRuntime();
  return (
    <Card className="border-border/60 bg-card/30">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Swarm event timeline</CardTitle>
        <p className="text-[10px] text-muted-foreground">Deterministic stream derived from the local simulator bus (replay-friendly).</p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[220px] px-4 pb-3">
          <div className="space-y-1 text-[10px] font-mono">
            {runtimeEvents.map((e) => (
              <div key={e.id} className="flex flex-wrap items-start gap-2 border-b border-border/15 py-1">
                <Badge variant={KIND_VARIANT[e.kind] ?? "outline"} className="text-[9px] shrink-0">
                  {e.kind}
                </Badge>
                <div className="text-muted-foreground">
                  <span className="text-foreground/90">{e.label}</span>
                  {e.detail ? ` — ${e.detail}` : ""}
                </div>
              </div>
            ))}
            {!runtimeEvents.length && <div className="text-muted-foreground">Run the simulation to populate events.</div>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
