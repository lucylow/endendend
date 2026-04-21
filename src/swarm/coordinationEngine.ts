import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import type { MapCellMeta } from "./types";
import { mergePartitionMapDeltas } from "./recoveryManager";
import type { SharedMapDelta } from "./types";

export type CoordinationLayer = "local" | "remote" | "merged" | "tentative" | "committed" | "recovered";

export type CoordinationSnapshot = {
  missionId: string;
  nowMs: number;
  phase: string;
  connectivityMode: string;
  /** Replay-derived committed view (ledger-backed). */
  committedPhase: string;
  /** Live merged map cells from shared monotonic map (authoritative for exploration UI). */
  mergedMapCells: Record<string, MapCellMeta>;
  /** Frontier ownership from exploration coordinator output. */
  explorationByNode: Record<string, string[]>;
  /** Task ownership snapshot. */
  taskOwners: Record<string, string | undefined>;
  /** Target pipeline state keys. */
  targetIds: { candidate: string[]; confirmed: string[] };
  layers: Record<CoordinationLayer, string>;
};

/**
 * Presents a single merged coordination picture to the UI while keeping layer labels explicit.
 * Does not replace the simulator; it interprets `VertexSwarmView` for dashboards.
 */
export function buildCoordinationSnapshot(view: VertexSwarmView | null): CoordinationSnapshot | null {
  if (!view) return null;
  const explorationByNode: Record<string, string[]> = {};
  for (const ex of view.exploration) {
    explorationByNode[ex.nodeId] = ex.assignment?.frontierKeys ?? [];
  }
  const taskOwners: Record<string, string | undefined> = {};
  for (const t of view.tasks) {
    taskOwners[t.taskId] = t.winnerNodeId;
  }
  const cand = view.discovery.filter((d) => d.status === "candidate").map((d) => d.candidateId);
  const conf = view.discovery.filter((d) => d.status === "confirmed").map((d) => d.candidateId);
  return {
    missionId: view.missionId,
    nowMs: view.nowMs,
    phase: view.phase,
    connectivityMode: view.connectivityMode,
    committedPhase: view.missionReplay.phase,
    mergedMapCells: view.sharedMap.cells,
    explorationByNode,
    taskOwners,
    targetIds: { candidate: cand, confirmed: conf },
    layers: {
      local: "per-node autonomy directives + telemetry",
      remote: "last mesh snapshot + neighbor state",
      merged: "monotonic shared map + merged discovery list",
      tentative: "open/bidding tasks and frontier assignments",
      committed: "ledger tail + replay reconstruction",
      recovered: "sync_reconciled + partition delta merge",
    },
  };
}

/** Merge multiple map deltas as after a partition (CRDT-style). */
export function mergeCoordinationMapDeltas(deltas: SharedMapDelta[]): Record<string, MapCellMeta> {
  return mergePartitionMapDeltas(deltas);
}
