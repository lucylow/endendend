import type { MeshPeerRuntime } from "./types";

export function mergePeerViews(a: MeshPeerRuntime, b: Partial<MeshPeerRuntime>): MeshPeerRuntime {
  return {
    ...a,
    ...b,
    lastNeighbors: b.lastNeighbors ?? a.lastNeighbors,
    knownPeers: uniq([...a.knownPeers, ...(b.knownPeers ?? [])]),
    reachablePeers: uniq([...a.reachablePeers, ...(b.reachablePeers ?? [])]),
    suspectedPeers: uniq([...a.suspectedPeers, ...(b.suspectedPeers ?? [])]),
    stalePeers: uniq([...a.stalePeers, ...(b.stalePeers ?? [])]),
    newlyDiscovered: uniq([...a.newlyDiscovered, ...(b.newlyDiscovered ?? [])]),
  };
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs)];
}
