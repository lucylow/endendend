import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";

export function VertexMissionPanel({ view }: { view: VertexSwarmView | null }) {
  if (!view) {
    return (
      <Card className="border-border/60 bg-card/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Mission</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">Initializing…</CardContent>
      </Card>
    );
  }
  const m = view.missionReplay;
  return (
    <Card className="border-border/60 bg-card/30">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          Mission
          <Badge variant="outline" className="font-mono text-[10px]">
            {view.phase}
          </Badge>
        </CardTitle>
        <p className="text-[10px] text-muted-foreground font-mono">{view.missionId}</p>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div>
          <span className="text-muted-foreground">Scenario</span>{" "}
          <span className="text-foreground">{view.preset.label}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Map cells (ledger)</span>{" "}
          <span className="font-mono">{m.mapSummary.cellsKnown}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Live map (P2P)</span>{" "}
          <span className="font-mono">
            {(view.sharedMap.coverage01 * 100).toFixed(0)}% · {view.sharedMap.explored} searched · {view.sharedMap.frontier}{" "}
            frontier
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Checkpoints</span>{" "}
          <span className="font-mono">{m.recoveryCheckpoints.length}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Tasks completed</span>{" "}
          <span className="font-mono">{m.completedTaskIds?.length ?? 0}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Connectivity (ledger)</span>{" "}
          <span className="font-mono">{m.connectivityMode ?? "normal"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
