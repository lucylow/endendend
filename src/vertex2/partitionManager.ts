import type { ConnectivitySnapshot } from "@/backend/vertex/swarm-types";
import type { MeshPeerRuntime } from "./types";

export class PartitionManager {
  private active = false;

  get partitioned(): boolean {
    return this.active;
  }

  updateFromSnapshot(snap: ConnectivitySnapshot): void {
    this.active = snap.partitionClusters.length > 1;
  }

  labelForPeer(peerId: string, snap: ConnectivitySnapshot): string {
    const c = snap.partitionClusters.find((x) => x.includes(peerId));
    if (!c) return "P?";
    const idx = snap.partitionClusters.indexOf(c);
    return `P${idx}`;
  }

  applyToPeers(peers: Map<string, MeshPeerRuntime>, snap: ConnectivitySnapshot): void {
    for (const [id, p] of peers) {
      p.partitionId = this.labelForPeer(id, snap);
      if (!snap.operatorReachable.has(id) && p.health !== "offline") {
        p.health = "isolated";
        p.recovery = "buffering";
      } else if (p.health === "isolated" && snap.operatorReachable.has(id)) {
        p.health = "recovering";
        p.recovery = "reconciling";
      }
    }
  }
}
