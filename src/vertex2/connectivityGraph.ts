import type { ConnectivitySnapshot, GraphEdge } from "@/backend/vertex/swarm-types";
import type { MeshGraphView, MeshLinkQuality } from "./types";
import type { NetworkConditionVector } from "./types";
import { clamp01 } from "./normalizers";

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Approximate articulation: node is bridge if removing it increases components (local heuristic on small graphs). */
export function estimateBridges(nodeIds: string[], edges: { a: string; b: string }[]): Set<string> {
  const bridges = new Set<string>();
  const adj = new Map<string, Set<string>>();
  for (const id of nodeIds) adj.set(id, new Set());
  for (const e of edges) {
    adj.get(e.a)?.add(e.b);
    adj.get(e.b)?.add(e.a);
  }
  const countComponents = (ignore?: string) => {
    const seen = new Set<string>();
    let comps = 0;
    for (const n of nodeIds) {
      if (n === ignore) continue;
      if (seen.has(n)) continue;
      comps++;
      const st = [n];
      seen.add(n);
      while (st.length) {
        const x = st.pop()!;
        for (const y of adj.get(x) ?? []) {
          if (y === ignore) continue;
          if (seen.has(y)) continue;
          seen.add(y);
          st.push(y);
        }
      }
    }
    return comps;
  };
  const baseline = countComponents();
  for (const n of nodeIds) {
    if (countComponents(n) > baseline) bridges.add(n);
  }
  return bridges;
}

export function buildMeshGraphView(
  snap: ConnectivitySnapshot,
  operatorId: string,
  vector: NetworkConditionVector,
): MeshGraphView {
  const nodes = new Set<string>();
  for (const e of snap.edges) {
    nodes.add(e.a);
    nodes.add(e.b);
  }
  const nodeList = [...nodes];
  const bridges = estimateBridges(nodeList, snap.edges);
  const links: MeshLinkQuality[] = snap.edges.map((e) => {
    const stress = clamp01(1 - e.quality01 + vector.routeInstability01 * 0.35);
    const latencyMs = Math.max(8, e.latencyMs + vector.baseLatencyMs * 0.25 + vector.jitterMs * stress);
    const loss01 = clamp01(e.loss * 0.55 + vector.loss01 * 0.45);
    return {
      a: e.a,
      b: e.b,
      latencyMs,
      loss01,
      quality01: clamp01(e.quality01 * (1 - vector.loss01 * 0.35)),
      viaRelay: e.viaRelay,
      isBridge: bridges.has(e.a) || bridges.has(e.b),
    };
  });
  const relayRank = nodeList
    .map((peerId) => {
      let score = 0;
      for (const l of links) {
        if (l.a !== peerId && l.b !== peerId) continue;
        score += l.quality01 * (1 - l.loss01);
      }
      return { peerId, score01: clamp01(score / Math.max(1, links.filter((x) => x.a === peerId || x.b === peerId).length)) };
    })
    .sort((a, b) => b.score01 - a.score01);
  const reachable = [...snap.operatorReachable];
  const isolated = nodeList.filter((id) => !snap.operatorReachable.has(id));
  const partitionLabels: Record<string, string> = {};
  snap.partitionClusters.forEach((c, i) => {
    const label = `P${i}`;
    for (const id of c) partitionLabels[id] = label;
  });
  return {
    nodes: nodeList,
    links,
    bridges: [...bridges],
    relayRank,
    operatorReachable: reachable,
    isolated,
    partitionLabels,
  };
}

export function pickRelayPathHint(edges: GraphEdge[], from: string, to: string, relayCandidates: string[]): string | undefined {
  for (const r of relayCandidates) {
    const a = edges.find((e) => (e.a === from && e.b === r) || (e.b === from && e.a === r));
    const b = edges.find((e) => (e.a === r && e.b === to) || (e.b === r && e.a === to));
    if (a && b && a.quality01 > 0.12 && b.quality01 > 0.12) return r;
  }
  return undefined;
}
