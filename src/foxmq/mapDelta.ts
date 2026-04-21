import type { MapCellMeta } from "@/swarm/types";
import type { FoxMqDeliveryStatus } from "./types";

export type MapDeltaRetryStatus = "none" | "scheduled" | "exhausted";

export type MapDelta = {
  deltaId: string;
  sourceNodeId: string;
  missionId: string;
  mapId: string;
  baseVersion: number;
  cellsChanged: Record<string, MapCellMeta>;
  changesetSummary: string;
  timestamp: number;
  checksum: string;
  causalSeq: number;
  retryStatus: MapDeltaRetryStatus;
  deliveryStatus: FoxMqDeliveryStatus;
};

export function checksumDeltaCells(cells: Record<string, MapCellMeta>): string {
  const keys = Object.keys(cells).sort();
  let h = 2166136261;
  for (const k of keys) {
    const blob = `${k}:${JSON.stringify(cells[k])}`;
    for (let i = 0; i < blob.length; i++) {
      h ^= blob.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return (h >>> 0).toString(16);
}

export function buildMapDelta(args: {
  deltaId: string;
  sourceNodeId: string;
  missionId: string;
  mapId: string;
  baseVersion: number;
  cells: Record<string, MapCellMeta>;
  causalSeq: number;
  timestamp: number;
}): MapDelta {
  const checksum = checksumDeltaCells(args.cells);
  return {
    deltaId: args.deltaId,
    sourceNodeId: args.sourceNodeId,
    missionId: args.missionId,
    mapId: args.mapId,
    baseVersion: args.baseVersion,
    cellsChanged: args.cells,
    changesetSummary: `${Object.keys(args.cells).length} cells @v${args.baseVersion}`,
    timestamp: args.timestamp,
    checksum,
    causalSeq: args.causalSeq,
    retryStatus: "none",
    deliveryStatus: "pending",
  };
}
