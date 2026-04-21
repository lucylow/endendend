import type { MapCellMeta } from "@/swarm/types";
import type { FoxMqMapPublicState } from "./mapSyncEngine";
import type { ConnectivitySnapshot } from "@/backend/vertex/swarm-types";

export function coveragePct(cells: Record<string, MapCellMeta>): number {
  let frontier = 0;
  let explored = 0;
  for (const c of Object.values(cells)) {
    if (c.state === "frontier") frontier += 1;
    if (
      c.state === "seen" ||
      c.state === "searched" ||
      c.state === "safe" ||
      c.state === "target" ||
      c.state === "blocked" ||
      c.state === "hazard" ||
      c.state === "relay_critical" ||
      c.state === "unreachable"
    )
      explored += 1;
  }
  const denom = Math.max(1, explored + frontier);
  return Math.min(100, (explored / denom) * 100);
}

export function searchedCount(cells: Record<string, MapCellMeta>): number {
  return Object.values(cells).filter((c) => c.state === "searched").length;
}

export function frontierCount(cells: Record<string, MapCellMeta>): number {
  return Object.values(cells).filter((c) => c.state === "frontier").length;
}

export function blockedCount(cells: Record<string, MapCellMeta>): number {
  return Object.values(cells).filter((c) => c.state === "blocked" || c.state === "unreachable").length;
}

export function targetCount(cells: Record<string, MapCellMeta>): number {
  return Object.values(cells).filter((c) => c.state === "target").length;
}

export function hazardCount(cells: Record<string, MapCellMeta>): number {
  return Object.values(cells).filter((c) => c.state === "hazard").length;
}

export function dirtyCount(cells: Record<string, MapCellMeta>): number {
  return Object.values(cells).filter((c) => c.dirtyLocal).length;
}

export function offlineNodeCount(nodeIds: string[], offline: Set<string>): number {
  return nodeIds.filter((id) => offline.has(id)).length;
}

export function staleNodeCount(graph: ConnectivitySnapshot): number {
  return graph.stalePeers?.size ?? 0;
}

export function syncLagMs(fox: FoxMqMapPublicState | undefined): number {
  return fox?.syncLagMs ?? 0;
}

export function recoveryProgress(fox: FoxMqMapPublicState | undefined): number {
  return (fox?.recoveryProgress01 ?? 0) * 100;
}

export function collectiveMemoryHealth(fox: FoxMqMapPublicState | undefined): number {
  return (fox?.collectiveMemoryHealth01 ?? 0) * 100;
}

export function partitionCount(graph: ConnectivitySnapshot): number {
  return graph.partitionClusters?.length ?? 0;
}

export function mergeConflictsResolved(fox: FoxMqMapPublicState | undefined): number {
  return fox?.mergeConflictsResolved ?? 0;
}
