import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePeerMesh } from "@/hooks/usePeerMesh";

const KIND_COLOR: Record<string, string> = {
  direct: "bg-emerald-500/25 text-emerald-200",
  degraded: "bg-amber-500/25 text-amber-100",
  relayed: "bg-sky-500/25 text-sky-100",
  stale: "bg-zinc-600/40 text-zinc-200",
};

export function SwarmPeerGraph() {
  const { links, partition, rerouteHint } = usePeerMesh();
  return (
    <Card className="border-border/60 bg-card/30">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Peer link graph</CardTitle>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Direct mesh edges (no central broker). Degraded / relayed / stale classes come from link quality + heartbeat loss.
        </p>
        {rerouteHint && (
          <Badge variant="outline" className="text-[10px] w-fit">
            Suggested reroute anchor: {rerouteHint}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="max-h-[220px] overflow-y-auto space-y-1 text-[10px] font-mono">
        <div className="text-muted-foreground mb-2">
          Partitions: {partition.clusterCount} · isolated from command anchor: {partition.isolatedFromOperator.length}
        </div>
        {links.slice(0, 48).map((e, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1 border-b border-border/20 py-0.5">
            <span className="text-foreground">
              {e.peerA}↔{e.peerB}
            </span>
            <span className={`rounded px-1 py-0.5 ${KIND_COLOR[e.kind] ?? "bg-muted/30"}`}>{e.kind}</span>
            <span className="text-muted-foreground">q={(e.quality01 * 100).toFixed(0)}%</span>
            <span className="text-muted-foreground">lat {e.latencyMs}ms</span>
            {e.relayHint && <span className="text-primary/80">via {e.relayHint}</span>}
          </div>
        ))}
        {links.length > 48 && <div className="text-muted-foreground pt-1">… {links.length - 48} more edges</div>}
      </CardContent>
    </Card>
  );
}
