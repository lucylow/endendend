import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MESH_SCENARIO_PRESETS } from "@/mesh/networkConstraints";
import type { MeshSurvivalPublicView } from "@/mesh/types";
import { MeshDiscoveryPanel } from "@/components/MeshDiscoveryPanel";
import { MeshGraphPanel } from "@/components/MeshGraphPanel";
import { MeshRelayPanel } from "@/components/MeshRelayPanel";
import { MeshPartitionPanel } from "@/components/MeshPartitionPanel";
import { MeshReplayPanel } from "@/components/MeshReplayPanel";
import { MeshEventFeed } from "@/components/MeshEventFeed";
import { useMeshSimulation } from "@/hooks/useMeshSimulation";
import { RadioTower, Route } from "lucide-react";

export function MeshSurvivalPanel({ mesh }: { mesh: MeshSurvivalPublicView | null }) {
  const { meshSetStressPreset, meshForceRelayNomination } = useMeshSimulation();
  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-card/90 to-card/50">
      <CardHeader className="py-3 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <RadioTower className="w-4 h-4 text-emerald-500" />
            Mesh survival engine
          </CardTitle>
          <Badge variant="outline" className="text-[10px] font-normal">
            {mesh?.liveMode === "live" ? "live fabric" : "mock fallback"}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Modular P2P layer: graded discovery, weighted graph, autonomous relay picks, dual routes, retrying message bus,
          partition buffers, and merged replay — runs beside Vertex&nbsp;2.0 without hardcoded static topology.
        </p>
        <div className="flex flex-wrap items-end gap-3 pt-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Stress scenario (mesh presets)</Label>
            <Select
              value={mesh?.stressPresetId ?? "normal_mesh"}
              onValueChange={(id) => {
                meshSetStressPreset(id);
              }}
            >
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <SelectValue placeholder="Preset" />
              </SelectTrigger>
              <SelectContent>
                {MESH_SCENARIO_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => meshForceRelayNomination()}>
            Force relay window
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] pt-1">
          <Badge variant="secondary">constraint {mesh?.constraintMode ?? "—"}</Badge>
          <Badge variant="secondary">vertex {mesh?.vertexConnectivity ?? "—"}</Badge>
          <Badge variant="outline">stress {mesh?.vertexStress ?? "—"}</Badge>
          <Badge variant="outline" className="gap-1">
            <Route className="w-3 h-3" />
            routes {mesh?.routePlans.length ?? 0}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-semibold mb-2">Discovery registry</h3>
            <MeshDiscoveryPanel mesh={mesh} />
          </div>
          <div>
            <h3 className="text-xs font-semibold mb-2">Operational graph</h3>
            <MeshGraphPanel mesh={mesh} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-semibold mb-2">Relay planner</h3>
            <MeshRelayPanel mesh={mesh} />
          </div>
          <div>
            <h3 className="text-xs font-semibold mb-2">Partitions & recovery</h3>
            <MeshPartitionPanel mesh={mesh} />
          </div>
        </div>
        {mesh && mesh.routePlans.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold mb-2">Route optimizer (primary / backup)</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 text-[10px] font-mono">
              {mesh.routePlans.map((rp, i) => (
                <div key={i} className="rounded-md border border-border/35 bg-background/30 p-2 space-y-1">
                  <div className="text-foreground">
                    {rp.topic} · {(rp.primaryQuality01 * 100).toFixed(0)}% / backup {(rp.backupQuality01 * 100).toFixed(0)}%
                  </div>
                  <div className="text-emerald-600/90">P: {rp.primaryPath.join(" → ")}</div>
                  <div className="text-muted-foreground">B: {rp.backupPath.join(" → ")}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-semibold mb-2">Message bus</h3>
            <p className="text-[11px] text-muted-foreground mb-1">
              delivered {mesh?.bus.stats.delivered ?? 0} · dropped {mesh?.bus.stats.dropped ?? 0} · buffered{" "}
              {mesh?.bus.stats.buffered ?? 0} · dup merged {mesh?.bus.stats.duplicatesMerged ?? 0}
            </p>
            <div className="font-mono text-[10px] text-muted-foreground space-y-1 max-h-[120px] overflow-y-auto border border-border/30 rounded-md p-2">
              {(mesh?.bus.recent ?? []).slice(0, 8).map((m) => (
                <div key={m.messageId}>
                  {m.topic} · {m.deliveryStatus} · {m.pathTaken.join("→")}
                </div>
              ))}
            </div>
            <h3 className="text-xs font-semibold mb-2 mt-3">Ledger tail (mesh + Vertex2)</h3>
            <MeshEventFeed mesh={mesh} />
          </div>
          <div>
            <h3 className="text-xs font-semibold mb-2">Mesh replay</h3>
            <MeshReplayPanel mesh={mesh} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
