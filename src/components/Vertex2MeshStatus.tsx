import { Badge } from "@/components/ui/badge";
import type { MeshResiliencePublicView } from "@/vertex2/types";

export function Vertex2MeshStatus({ mesh }: { mesh: MeshResiliencePublicView | null }) {
  if (!mesh) return <p className="text-xs text-muted-foreground">Mesh layer initializing…</p>;
  const s = mesh.stats;
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-muted-foreground">Stress</span>
        <Badge variant="outline">{mesh.stressMode}</Badge>
        <span className="text-muted-foreground">Vertex link</span>
        <Badge variant="secondary">{mesh.connectivityMode}</Badge>
        <span className="text-muted-foreground">Runtime</span>
        <Badge>{mesh.liveMode}</Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[10px] text-muted-foreground">
        <div>votes delivered: {s.deliveredVotes}</div>
        <div>dropped: {s.droppedVotes}</div>
        <div>dup: {s.duplicates}</div>
        <div>buffered: {s.bufferedWhileOffline}</div>
        <div>reroutes: {s.reroutes}</div>
        <div>pulse: {mesh.discoveryPulse}</div>
      </div>
    </div>
  );
}
