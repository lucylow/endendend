import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSwarmRuntime } from "@/hooks/useSwarmRuntime";
import { usePeerMesh } from "@/hooks/usePeerMesh";

export function SwarmRecoveryPanel() {
  const { view, runtimeEvents } = useSwarmRuntime();
  const { partition } = usePeerMesh();
  if (!view) {
    return (
      <Card className="border-border/60 bg-card/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Partition & recovery</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">No simulation view yet.</CardContent>
      </Card>
    );
  }
  const recoveryHints = runtimeEvents.filter((e) => e.kind === "mesh" || e.kind === "ledger").slice(0, 12);
  return (
    <Card className="border-border/60 bg-card/30">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Partition & recovery</CardTitle>
        <div className="flex flex-wrap gap-1 pt-1">
          <Badge variant={view.blackoutActive ? "destructive" : "secondary"} className="text-[10px]">
            {view.connectivityMode}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            command partition {partition.operatorPartitionSize} nodes
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-xs space-y-2 text-muted-foreground">
        <div>
          Clusters: <span className="text-foreground">{partition.clusterCount}</span> · largest{" "}
          <span className="text-foreground">{partition.largestPartitionSize}</span>
        </div>
        {partition.isolatedFromOperator.length > 0 && (
          <div className="text-amber-200/90 text-[10px] font-mono">
            Not on command anchor component: {partition.isolatedFromOperator.join(", ")}
          </div>
        )}
        <div className="pt-1 text-[10px] font-mono space-y-1 max-h-[140px] overflow-y-auto border-t border-border/30">
          {recoveryHints.map((e) => (
            <div key={e.id}>
              <span className="text-foreground/90">{e.label}</span> — {e.detail ?? ""}
            </div>
          ))}
          {!recoveryHints.length && <span className="text-muted-foreground">Waiting for mesh events…</span>}
        </div>
      </CardContent>
    </Card>
  );
}
