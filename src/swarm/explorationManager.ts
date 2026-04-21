import type { SwarmAgentNode } from "@/backend/vertex/swarm-types";
import type { VertexConnectivityMode } from "@/backend/shared/mission-state";
import { MonotonicSharedMap, cellKey, parseCellKey } from "./sharedMap";
import type { ExplorationAssignment, NodeExplorationState } from "./types";
import type { ConnectivitySnapshot } from "@/backend/vertex/swarm-types";

type Rng = () => number;

function explorers(nodes: SwarmAgentNode[]): SwarmAgentNode[] {
  return nodes.filter((n) => n.role === "explorer" || n.autonomyPolicy === "scout_continue" || n.autonomyPolicy === "map_indoor");
}

/** Partitions frontier keys among active explorers using deterministic hashing. */
export function splitFrontiersAmongNodes(frontierKeys: string[], agentIds: string[], seed: number): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const id of agentIds) out.set(id, []);
  let h = seed >>> 0;
  const rnd = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const sorted = [...frontierKeys].sort();
  for (const k of sorted) {
    if (!agentIds.length) break;
    const idx = Math.floor(rnd() * agentIds.length);
    const id = agentIds[idx];
    out.get(id)!.push(k);
  }
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
    const activeExplorers = ex.filter((n) => {
      const edge = graph.getEdge?.(n.nodeId, operatorId);
      const reachable = graph.operatorReachable.has(n.nodeId);
      if (connectivityMode === "blackout" || connectivityMode === "partial_partition") {
        return true;
      }
      return reachable || (edge?.quality01 ?? 0) > 0.08;
    });
    const ids = activeExplorers.map((n) => n.nodeId);
    const frontierKeys = map.frontierKeys();
    if (!frontierKeys.length) {
      for (const n of activeExplorers.slice(0, 3)) {
        const { gx, gz } = MonotonicSharedMap.worldToGrid(n.position.x, n.position.z);
        map.applyLocalUpdate(gx, gz, "seen", nowMs, n.nodeId);
      }
      map.recomputeFrontiers();
    }

    const split = splitFrontiersAmongNodes(map.frontierKeys(), ids.length ? ids : nodes.map((n) => n.nodeId), args.nowMs);
    const states: NodeExplorationState[] = [];

    for (const n of nodes) {
      const assignedKeys = split.get(n.nodeId) ?? [];
      const sectorLabel = `S${Math.abs(n.nodeId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 97)}`;
      const assignment: ExplorationAssignment | null =
        assignedKeys.length > 0 ? { nodeId: n.nodeId, frontierKeys: assignedKeys, sectorLabel } : this.lastAssignments.get(n.nodeId) ?? null;
      if (assignment) this.lastAssignments.set(n.nodeId, assignment);

      let visited = 0;
      const isExplorer = n.role === "explorer" || n.autonomyPolicy === "scout_continue" || n.autonomyPolicy === "map_indoor";
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

      map.recomputeFrontiers();
      states.push({ nodeId: n.nodeId, cellsVisitedThisTick: visited, assignment });
    }

    return states;
  }

  /** Simulate P2P map sync along mesh edges (decentralized — no cloud). */
  gossipMapDeltas(map: MonotonicSharedMap, graph: ConnectivitySnapshot, nowMs: number, rng: Rng): number {
    let merges = 0;
    for (const e of graph.edges) {
      if (e.quality01 < 0.12 || rng() > 0.55 + e.quality01 * 0.35) continue;
      const keys = map.frontierKeys().concat(
        Object.keys(map.snapshotCells()).filter((k) => {
          const c = map.getCell(k);
          return c?.state === "searched" || c?.state === "target";
        }),
      );
      const sample = keys.slice(0, 6 + Math.floor(rng() * 6));
      if (sample.length < 2) continue;
      const delta = map.exportDelta(sample, e.a, nowMs);
      const before = map.snapshotCells();
      const { changedKeys } = map.mergeDelta({ ...delta, originNodeId: e.b });
      merges += changedKeys.length;
      void before;
    }
    return merges;
  }
}
