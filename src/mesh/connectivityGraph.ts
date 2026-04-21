import type { ConnectivitySnapshot } from "@/backend/vertex/swarm-types";
import type { MeshOperationalEdge, MeshOperationalGraph, MeshPeerRichProfile } from "./types";

function routeCost(e: { latencyMs: number; loss: number; quality01: number }): number {
  const q = Math.max(0.05, e.quality01);
  return e.latencyMs * (1 + e.loss * 2.2) * (1 / q);
}

export function buildOperationalGraph(
  snap: ConnectivitySnapshot,
  profiles: MeshPeerRichProfile[],
): MeshOperationalGraph {
  const nodeSet = new Set<string>();
  for (const c of snap.partitionClusters) for (const id of c) nodeSet.add(id);
  for (const p of profiles) nodeSet.add(p.nodeId);

  const edges: MeshOperationalEdge[] = snap.edges.map((e) => {
    const pa = profiles.find((p) => p.nodeId === e.a);
    const pb = profiles.find((p) => p.nodeId === e.b);
    const relayImportance =
      0.5 * (pa?.relaySuitability01 ?? 0.5) + 0.5 * (pb?.relaySuitability01 ?? 0.5) + (e.viaRelay ? 0.12 : 0);
    return {
      ...e,
      routeCost: routeCost(e),
      relayImportance01: Math.min(1, relayImportance),
      indirectHint: e.viaRelay,
    };
  });

  const deg = new Map<string, number>();
  for (const e of edges) {
    deg.set(e.a, (deg.get(e.a) ?? 0) + 1);
    deg.set(e.b, (deg.get(e.b) ?? 0) + 1);
  }
  const bridgeNodes: string[] = [];
  for (const [id, d] of deg) {
    if (snap.partitionClusters.length > 1 && d >= 2) {
      let crosses = 0;
      for (const e of edges) {
        if (e.a !== id && e.b !== id) continue;
        const other = e.a === id ? e.b : e.a;
        const ci = snap.partitionClusters.findIndex((c) => c.includes(id));
        const cj = snap.partitionClusters.findIndex((c) => c.includes(other));
        if (ci >= 0 && cj >= 0 && ci !== cj) crosses++;
      }
      if (crosses > 0) bridgeNodes.push(id);
    }
  }

  const isolatedNodes = [...nodeSet].filter((id) => !snap.operatorReachable.has(id) && !snap.stalePeers.has(id));
  const recoveryEdges = edges.filter((e) => snap.stalePeers.has(e.a) || snap.stalePeers.has(e.b));

  return {
    nodes: [...nodeSet],
    edges,
    partitionClusters: snap.partitionClusters,
    bridgeNodes: [...new Set(bridgeNodes)],
    bottleneckEdge: snap.bottleneckEdge
      ? {
          ...snap.bottleneckEdge,
          routeCost: routeCost(snap.bottleneckEdge),
          relayImportance01: 0.55,
        }
      : undefined,
    isolatedNodes,
    operatorReachable: [...snap.operatorReachable],
    recoveryEdges,
  };
}
