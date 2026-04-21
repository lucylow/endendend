import type { ConnectivitySnapshot } from "@/backend/vertex/swarm-types";
import type { MeshPeerRuntime } from "./types";
import type { NetworkConditionVector } from "./types";
import { clamp01 } from "./normalizers";

function neighborsOf(peerId: string, snap: ConnectivitySnapshot): string[] {
  const out: string[] = [];
  for (const e of snap.edges) {
    if (e.a === peerId) out.push(e.b);
    else if (e.b === peerId) out.push(e.a);
  }
  return out;
}

/**
 * Lattice-style mesh discovery: partial visibility, delayed neighbor exchange, relay-assisted reachability.
 */
export function advanceDiscovery(
  peers: Map<string, MeshPeerRuntime>,
  snap: ConnectivitySnapshot,
  vector: NetworkConditionVector,
  rng: () => number,
): void {
  const delayPenalty = clamp01(0.15 + vector.loss01 * 0.5 + vector.routeInstability01 * 0.25);
  for (const [id, p] of peers) {
    if (p.health === "offline") continue;
    const nbrs = neighborsOf(id, snap);
    p.lastNeighbors = nbrs;
    const prevKnown = new Set(p.knownPeers);
    for (const n of nbrs) {
      if (n === id) continue;
      // Partial visibility: not every neighbor is learned each tick
      if (rng() > 0.55 - delayPenalty * 0.25) continue;
      if (!prevKnown.has(n)) p.newlyDiscovered.push(n);
      prevKnown.add(n);
    }
    // Relay-assisted second hop (soft): high relay peers learn more under stress
    if (p.relayScore01 > 0.55 && rng() < 0.18 + p.relayScore01 * 0.12) {
      for (const n of nbrs) {
        for (const m of neighborsOf(n, snap)) {
          if (m === id) continue;
          if (rng() < 0.08 + vector.retransmitPressure01 * 0.1) prevKnown.add(m);
        }
      }
    }
    p.knownPeers = [...prevKnown];
    const reach = new Set<string>([id]);
    for (const n of nbrs) {
      if (snap.operatorReachable.has(n) || snap.operatorReachable.has(id)) reach.add(n);
      if (rng() < 1 - vector.loss01 * 0.4) reach.add(n);
    }
    p.reachablePeers = [...reach];
    p.suspectedPeers = nbrs.filter((n) => rng() < vector.staleDelivery01 + 0.04);
    p.stalePeers = p.suspectedPeers.filter(() => rng() < 0.35);
    // trim discovery noise
    p.newlyDiscovered = p.newlyDiscovered.slice(-6);
  }
}
