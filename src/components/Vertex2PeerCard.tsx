import { Badge } from "@/components/ui/badge";
import type { MeshPeerRuntime } from "@/vertex2/types";

export function Vertex2PeerCard({ peer }: { peer: MeshPeerRuntime }) {
  return (
    <div className="rounded-lg border border-border/50 p-2 space-y-1 text-[10px]">
      <div className="flex justify-between gap-2">
        <span className="font-medium text-foreground truncate">{peer.displayName}</span>
        <Badge variant="outline" className="text-[9px] shrink-0">
          {peer.meshRole}
        </Badge>
      </div>
      <div className="text-muted-foreground font-mono">{peer.peerId}</div>
      <div className="flex flex-wrap gap-1">
        <Badge variant="secondary" className="text-[9px]">
          {peer.nodeKind.replaceAll("_", " ")}
        </Badge>
        <Badge variant={peer.health === "ok" ? "default" : "destructive"} className="text-[9px]">
          {peer.health}
        </Badge>
        <span className="text-muted-foreground">P:{peer.partitionId}</span>
      </div>
      <div className="text-muted-foreground">
        trust {(peer.trust01 * 100).toFixed(0)}% · bat {(peer.battery01 * 100).toFixed(0)}% · q {peer.queueDepth} · relay{" "}
        {(peer.relayScore01 * 100).toFixed(0)}%
      </div>
      <div className="text-muted-foreground truncate">nbrs {peer.lastNeighbors.join(", ") || "—"}</div>
    </div>
  );
}
