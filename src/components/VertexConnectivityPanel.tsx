import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";

export function VertexConnectivityPanel({ view }: { view: VertexSwarmView | null }) {
  if (!view) return null;
  const g = view.graph;
  return (
    <Card className="border-border/60 bg-card/30">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Connectivity</CardTitle>
        <div className="flex flex-wrap gap-1 pt-1">
          <Badge variant={view.blackoutActive ? "destructive" : "secondary"} className="text-[10px]">
            {view.connectivityMode}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {g.edges.length} edges
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-xs space-y-2 font-mono text-muted-foreground">
        <div>
          Operator reach:{" "}
          <span className="text-foreground">{g.operatorReachable.size}</span> nodes
        </div>
        <div>Partitions: {g.partitionClusters.length}</div>
        {g.partitionClusters.map((c, i) => (
          <div key={i} className="pl-2 border-l border-border/50 text-[10px] truncate">
            {c.join(", ")}
          </div>
        ))}
        {g.bottleneckEdge && (
          <div className="text-[10px] pt-1">
            Bottleneck: {g.bottleneckEdge.a}↔{g.bottleneckEdge.b} q=
            {(g.bottleneckEdge.quality01 * 100).toFixed(0)}%
          </div>
        )}
        {g.relayChains.slice(0, 2).map((chain, i) => (
          <div key={i} className="text-[10px] text-primary/80">
            Relay chain: {chain.join(" → ")}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
