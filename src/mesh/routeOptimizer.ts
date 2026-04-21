import type { ConnectivitySnapshot, GraphEdge } from "@/backend/vertex/swarm-types";
import type { RoutePlan } from "./types";

type Adj = Map<string, { to: string; w: number; edge: GraphEdge }[]>;

function buildAdj(snap: ConnectivitySnapshot): Adj {
  const m: Adj = new Map();
  for (const e of snap.edges) {
    const wa = e.latencyMs * (1 + e.loss * 2.5) / Math.max(0.08, e.quality01);
    const wb = wa;
    if (!m.has(e.a)) m.set(e.a, []);
    if (!m.has(e.b)) m.set(e.b, []);
    m.get(e.a)!.push({ to: e.b, w: wa, edge: e });
    m.get(e.b)!.push({ to: e.a, w: wb, edge: e });
  }
  return m;
}

function shortestPath(adj: Adj, from: string, to: string): { path: string[]; cost: number } | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | undefined>();
  const pq: { id: string; d: number }[] = [{ id: from, d: 0 }];
  dist.set(from, 0);
  while (pq.length) {
    pq.sort((a, b) => a.d - b.d);
    const cur = pq.shift()!;
    if (cur.id === to) break;
    if ((dist.get(cur.id) ?? Infinity) < cur.d) continue;
    for (const nx of adj.get(cur.id) ?? []) {
      const nd = cur.d + nx.w;
      if (nd < (dist.get(nx.to) ?? Infinity)) {
        dist.set(nx.to, nd);
        prev.set(nx.to, cur.id);
        pq.push({ id: nx.to, d: nd });
      }
    }
  }
  if (!dist.has(to)) return null;
  const path: string[] = [];
  let x: string | undefined = to;
  while (x) {
    path.push(x);
    x = prev.get(x);
  }
  path.reverse();
  return { path, cost: dist.get(to)! };
}

function pathQuality(path: string[], snap: ConnectivitySnapshot): number {
  if (path.length < 2) return 0.35;
  let acc = 1;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const e = snap.edges.find((ed) => (ed.a === a && ed.b === b) || (ed.a === b && ed.b === a));
    if (!e) return 0.1;
    acc *= Math.max(0.05, e.quality01 * (1 - e.loss));
  }
  return Math.max(0.05, Math.min(1, acc));
}

/**
 * Primary + backup routes for mission-critical topics (state sync, discovery, recovery).
 */
export function computeRoutePlans(args: {
  snap: ConnectivitySnapshot;
  operatorId: string;
  targets: string[];
}): RoutePlan[] {
  const { snap, operatorId, targets } = args;
  const adj = buildAdj(snap);
  const plans: RoutePlan[] = [];
  const topics = ["state_sync", "discovery_gossip", "task_update", "heartbeat_propagation", "recovery_sync"];

  for (const tgt of targets) {
    if (tgt === operatorId) continue;
    const primary = shortestPath(adj, operatorId, tgt);
    if (!primary) continue;

    let backupPath: string[] = [];
    let backupQ = 0.08;
    for (let hop = 0; hop < Math.max(0, primary.path.length - 1); hop++) {
      const dropA = primary.path[hop]!;
      const dropB = primary.path[hop + 1]!;
      const adj2: Adj = new Map();
      for (const [k, list] of adj) {
        adj2.set(
          k,
          list.filter((x) => !((x.to === dropB && k === dropA) || (x.to === dropA && k === dropB))),
        );
      }
      const sp2 = shortestPath(adj2, operatorId, tgt);
      if (sp2 && sp2.path.join() !== primary.path.join()) {
        backupPath = sp2.path;
        backupQ = pathQuality(sp2.path, snap);
        break;
      }
    }

    plans.push({
      topic: topics[plans.length % topics.length]!,
      fromId: operatorId,
      toId: tgt,
      primaryPath: primary.path,
      backupPath: backupPath.length ? backupPath : primary.path.slice().reverse(),
      primaryQuality01: pathQuality(primary.path, snap),
      backupQuality01: backupQ,
    });
  }
  return plans.slice(0, 6);
}
