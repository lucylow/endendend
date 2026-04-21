import type { MapCellMeta, MapCellState, MapProofSource } from "@/swarm/types";

export type FoxMapCell = MapCellMeta & {
  cellId: string;
  gx: number;
  gz: number;
  z?: number;
};

export function makeCellId(gx: number, gz: number): string {
  return `${gx},${gz}`;
}

export function metaToFoxCell(gx: number, gz: number, m: MapCellMeta): FoxMapCell {
  return {
    cellId: makeCellId(gx, gz),
    gx,
    gz,
    ...m,
  };
}

export function foxCellToMeta(c: FoxMapCell): MapCellMeta {
  const { cellId: _c, gx: _x, gz: _z, z: _zz, ...rest } = c;
  return rest;
}

export function emptyMeta(state: MapCellState = "unknown"): Pick<MapCellMeta, "state" | "version" | "updatedAtMs"> {
  return { state, version: 0, updatedAtMs: 0 };
}

export function bumpMeta(
  prev: MapCellMeta | undefined,
  patch: Partial<MapCellMeta> & { state: MapCellState; version: number; updatedAtMs: number; lastNodeId?: string },
  proofSource: MapProofSource = "local_sensor",
): MapCellMeta {
  const base: MapCellMeta = prev
    ? { ...prev, ...patch, proofSource: patch.proofSource ?? prev.proofSource ?? proofSource }
    : {
        state: patch.state,
        version: patch.version,
        updatedAtMs: patch.updatedAtMs,
        lastNodeId: patch.lastNodeId,
        confidence01: patch.confidence01,
        firstSeenBy: patch.firstSeenBy ?? patch.lastNodeId,
        proofSource: patch.proofSource ?? proofSource,
        dirtyLocal: true,
      };
  if (!prev?.firstSeenBy && patch.lastNodeId) base.firstSeenBy = patch.lastNodeId;
  if (patch.confidence01 != null) base.confidence01 = Math.max(prev?.confidence01 ?? 0, patch.confidence01);
  base.dirtyLocal = true;
  return base;
}
