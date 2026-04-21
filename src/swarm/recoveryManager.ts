import type { SharedMapDelta } from "./types";
import { MonotonicSharedMap, mergeCellMeta } from "./sharedMap";
import type { MissionLedgerEvent } from "@/backend/vertex/mission-ledger";

/** Merge multiple node-local map deltas after partition — monotonic per cell. */
export function mergePartitionMapDeltas(deltas: SharedMapDelta[]): Record<string, import("./types").MapCellMeta> {
  const acc = new Map<string, import("./types").MapCellMeta>();
  for (const d of deltas) {
    for (const [k, remote] of Object.entries(d.cells)) {
      acc.set(k, mergeCellMeta(acc.get(k), remote));
    }
  }
  const out: Record<string, import("./types").MapCellMeta> = {};
  for (const [k, v] of acc) out[k] = v;
  return out;
}

export function materializeMergedMap(cells: Record<string, import("./types").MapCellMeta>): MonotonicSharedMap {
  return new MonotonicSharedMap(cells);
}

/** Build checkpoint payload from ledger tail + map snapshot for replay tooling. */
export function checkpointPayload(args: {
  missionId: string;
  label: string;
  mapCells: Record<string, import("./types").MapCellMeta>;
  ledgerTail: MissionLedgerEvent[];
}): Record<string, unknown> {
  return {
    missionId: args.missionId,
    label: args.label,
    mapCellCount: Object.keys(args.mapCells).length,
    ledgerTailHashes: args.ledgerTail.map((e) => e.eventHash),
  };
}
