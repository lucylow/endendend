import type { SwarmAgentNode, ConnectivitySnapshot } from "@/backend/vertex/swarm-types";
import type { VertexConnectivityMode } from "@/backend/shared/mission-state";
import { MonotonicSharedMap, parseCellKey } from "./sharedMap";
import type { ExplorationAssignment, NodeExplorationState } from "./types";

type Rng = () => number;

function explorers(nodes: SwarmAgentNode[]): SwarmAgentNode[] {
  return nodes.filter((n) => n.role === "explorer" || n.autonomyPolicy === "scout_continue" || n.autonomyPolicy === "map_indoor");
}

function edgeQualityToOperator(graph: ConnectivitySnapshot, nodeId: string, operatorId: string): number {
  const e = graph.edges.find(
    (x) => (x.a === nodeId && x.b === operatorId) || (x.b === nodeId && x.a === operatorId),
  );
  return e?.quality01 ?? 0;
}

/** Evenly partition sorted frontier keys among agent ids (deterministic). */
export function splitFrontiersAmongNodes(frontierKeys: string[], agentIds: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const id of agentIds) out.set(id, []);
  if (!agentIds.length) return out;
  const sorted = [...frontierKeys].sort();
  sorted.forEach((k, i) => {
    const id = agentIds[i % agentIds.length];
    out.get(id)!.push(k);
  });
  return out;
}

export class ExplorationCoordinator {
  private lastAssignments = new Map<string, ExplorationAssignment>();

  step(args: {
    map: MonotonicSharedMap;
    nodes: SwarmAgentNode[];
    connectivityMode: VertexConnectivityMode;
    graph: ConnectivitySnapshot;
    operatorId: string;
    nowMs: number;
    rng: Rng;
    scenarioMapHint: string;
  }): NodeExplorationState[] {
    const { map, nodes, connectivityMode, graph, operatorId, nowMs, rng, scenarioMapHint } = args;
    const ex = explorers(nodes);
    const opInMesh = graph.edges.some((e) => e.a === operatorId || e.b === operatorId);
    const activeExplorers = ex.filter((n) => {
      if (connectivityMode === "blackout" || connectivityMode === "partial_partition") return true;
      if (!opInMesh) return true;
      const reachable = graph.operatorReachable.has(n.nodeId);
      const q = edgeQualityToOperator(graph, n.nodeId, operatorId);
      return reachable || q > 0.08;
    });
    const explorerPool = activeExplorers.length ? activeExplorers : ex;
    const ids = explorerPool.map((n) => n.nodeId);
    let frontierKeys = map.frontierKeys();
    if (!frontierKeys.length) {
      const seedNodes = (explorerPool.length ? explorerPool : ex).slice(0, 3);
      for (const n of seedNodes.length ? seedNodes : nodes.slice(0, 2)) {
        const { gx, gz } = MonotonicSharedMap.worldToGrid(n.position.x, n.position.z);
        map.applyLocalUpdate(gx, gz, "seen", nowMs, n.nodeId);
      }
      map.recomputeFrontiers(nowMs, "bootstrap");
      frontierKeys = map.frontierKeys();
    }

    const agentIds = ids.length ? ids : nodes.map((n) => n.nodeId);
    const split = splitFrontiersAmongNodes(frontierKeys, agentIds);
    const states: NodeExplorationState[] = [];

    for (const n of nodes) {
      const assignedKeys = split.get(n.nodeId) ?? [];
      const sectorLabel = `sec-${(n.nodeId.length + assignedKeys.length) % 24}`;
      const assignment: ExplorationAssignment | null =
        assignedKeys.length > 0 ? { nodeId: n.nodeId, frontierKeys: assignedKeys, sectorLabel } : this.lastAssignments.get(n.nodeId) ?? null;
      if (assignment?.frontierKeys.length) this.lastAssignments.set(n.nodeId, assignment);

      let visited = 0;
      const isExplorer =
        n.role === "explorer" || n.autonomyPolicy === "scout_continue" || n.autonomyPolicy === "map_indoor";
      if (isExplorer && assignment?.frontierKeys.length) {
        const pickN = Math.max(1, Math.floor(1 + rng() * (connectivityMode === "degraded" ? 2 : 3)));
        const picks = assignment.frontierKeys.slice(0, pickN);
        for (const key of picks) {
          const p = parseCellKey(key);
          if (!p) continue;
          const jitter = scenarioMapHint.includes("low_gps") ? 0.35 : 0.15;
          n.position.x = p.gx * 4 + (rng() - 0.5) * 4 * jitter;
          n.position.z = p.gz * 4 + (rng() - 0.5) * 4 * jitter;
          const roll = rng();
          const state = roll < 0.06 ? "blocked" : roll < 0.12 && scenarioMapHint.includes("debris") ? "blocked" : "searched";
          map.applyLocalUpdate(p.gx, p.gz, state, nowMs, n.nodeId);
          visited += 1;
        }
      }

      map.recomputeFrontiers(nowMs, n.nodeId);
      states.push({ nodeId: n.nodeId, cellsVisitedThisTick: visited, assignment });
    }

    return states;
  }

  /** Simulate P2P map sync along mesh edges (decentralized — no cloud). */
  gossipMapDeltas(map: MonotonicSharedMap, graph: ConnectivitySnapshot, nowMs: number, rng: Rng): number {
    let merges = 0;
    for (const e of graph.edges) {
      if (e.quality01 < 0.12 || rng() > 0.55 + e.quality01 * 0.35) continue;
      const snap = map.snapshotCells();
      const keys = Object.keys(snap).filter((k) => {
        const c = map.getCell(k);
        return c && (c.state === "searched" || c.state === "target" || c.state === "frontier" || c.state === "blocked");
      });
      const sample = keys.slice(0, 6 + Math.floor(rng() * 6));
      if (sample.length < 2) continue;
      const delta = map.exportDelta(sample, e.a, nowMs);
      const { changedKeys } = map.mergeDelta({ ...delta, originNodeId: e.b });
      merges += changedKeys.length;
    }
    return merges;
  }
}
