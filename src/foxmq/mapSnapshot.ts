import type { MapCellMeta } from "@/swarm/types";
import { checksumDeltaCells } from "./mapDelta";

export type MapSnapshot = {
  mapId: string;
  mapVersion: number;
  timestamp: number;
  cells: Record<string, MapCellMeta>;
  coveragePct: number;
  frontierCount: number;
  searchedCount: number;
  blockedCount: number;
  targetCount: number;
  hazardCount: number;
  dirtyDeltaCount: number;
  lastSyncPeer?: string;
  sourceLabels: string[];
  checksum: string;
};

export function buildMapSnapshot(args: {
  mapId: string;
  mapVersion: number;
  timestamp: number;
  cells: Record<string, MapCellMeta>;
  lastSyncPeer?: string;
  sourceLabels?: string[];
}): MapSnapshot {
  const cells = args.cells;
  let frontierCount = 0;
  let searchedCount = 0;
  let blockedCount = 0;
  let targetCount = 0;
  let hazardCount = 0;
  let explored = 0;
  let dirtyDeltaCount = 0;
  const total = Object.keys(cells).length;
  for (const c of Object.values(cells)) {
    if (c.state === "frontier") frontierCount += 1;
    if (c.state === "searched") searchedCount += 1;
    if (c.state === "blocked" || c.state === "unreachable") blockedCount += 1;
    if (c.state === "target") targetCount += 1;
    if (c.state === "hazard") hazardCount += 1;
    if (c.dirtyLocal) dirtyDeltaCount += 1;
    if (
      c.state === "seen" ||
      c.state === "searched" ||
      c.state === "safe" ||
      c.state === "target" ||
      c.state === "blocked" ||
      c.state === "hazard" ||
      c.state === "relay_critical" ||
      c.state === "unreachable"
    ) {
      explored += 1;
    }
  }
  const denom = Math.max(1, explored + frontierCount);
  const coveragePct = Math.min(100, (explored / denom) * 100);
  const checksum = checksumDeltaCells(cells);
  return {
    mapId: args.mapId,
    mapVersion: args.mapVersion,
    timestamp: args.timestamp,
    cells,
    coveragePct,
    frontierCount,
    searchedCount,
    blockedCount,
    targetCount,
    hazardCount,
    dirtyDeltaCount,
    lastSyncPeer: args.lastSyncPeer,
    sourceLabels: args.sourceLabels ?? ["collective_mesh"],
    checksum,
  };
}
