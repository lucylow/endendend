import type { ConnectivitySnapshot } from "@/backend/vertex/swarm-types";

export type RouteMode = "flood" | "neighbor";

/** Picks neighbor ids for gossip along mesh edges (undirected). */
export function neighborsForNode(graph: ConnectivitySnapshot, nodeId: string, limit = 8): string[] {
  const out = new Set<string>();
  for (const e of graph.edges) {
    if (e.a === nodeId) out.add(e.b);
    else if (e.b === nodeId) out.add(e.a);
  }
  return [...out].slice(0, limit);
}

export function pickRelayTargets(
  graph: ConnectivitySnapshot,
  from: string,
  rng: () => number,
  maxTargets: number,
): string[] {
  const n = neighborsForNode(graph, from, 32);
  if (!n.length) return [];
  const k = Math.min(maxTargets, 1 + Math.floor(rng() * Math.min(3, n.length)));
  const shuffled = [...n].sort(() => rng() - 0.5);
  return shuffled.slice(0, k);
}
