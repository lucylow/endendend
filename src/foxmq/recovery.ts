import type { MapCellMeta, SharedMapDelta } from "@/swarm/types";
import { mergeMapCellMeta } from "./mapMerge";

export type RecoveryResult = {
  mergedCells: Record<string, MapCellMeta>;
  recoveredFromCollective: boolean;
  cellsHydrated: number;
};

/**
 * Rehydrate a returning node's local view from the fleet collective map without losing monotonicity.
 */
export function rehydrateNodeFromCollective(args: {
  collective: Record<string, MapCellMeta>;
  localOverlay: Record<string, MapCellMeta>;
  nodeId: string;
}): RecoveryResult {
  const mergedCells: Record<string, MapCellMeta> = {};
  let cellsHydrated = 0;
  for (const [k, remote] of Object.entries(args.collective)) {
    const local = args.localOverlay[k];
    const m = mergeMapCellMeta(local, { ...remote, proofSource: remote.proofSource ?? "recovery" }, "collective");
    mergedCells[k] = m;
    if (!local || m.version !== local.version || m.state !== local.state) cellsHydrated += 1;
  }
  for (const [k, local] of Object.entries(args.localOverlay)) {
    if (mergedCells[k]) continue;
    mergedCells[k] = { ...local, proofSource: local.proofSource ?? "local_sensor" };
  }
  return {
    mergedCells,
    recoveredFromCollective: cellsHydrated > 0,
    cellsHydrated,
  };
}

export function deltaFromRecord(cells: Record<string, MapCellMeta>, originNodeId: string, nowMs: number): SharedMapDelta {
  return { cells, originNodeId, emittedAtMs: nowMs };
}
