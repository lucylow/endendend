import type { CollectiveMapDelta, EngineConfig, MapCell, SimNode, TunnelMapState } from "./types";

const CELL_STEP = 3.5;

export function initialTunnelMap(cfg: EngineConfig): TunnelMapState {
  const cells: MapCell[] = [];
  for (let s = 0; s <= cfg.tunnel.lengthM; s += CELL_STEP) {
    cells.push({ s, kind: "unexplored" });
  }
  for (const z of cfg.tunnel.targetZones) {
    for (const c of cells) {
      if (c.s >= z.startS && c.s <= z.endS) c.kind = "target";
    }
  }
  for (const seg of cfg.tunnel.segments) {
    if (!seg.blocked) continue;
    for (const c of cells) {
      if (c.s >= seg.startS && c.s <= seg.endS) c.kind = "blocked";
    }
  }
  return { cells, coverage: 0, frontierS: 0 };
}

export function updateMapFromExplorer(
  map: TunnelMapState,
  explorer: SimNode,
  dt: number,
  contributorId: string,
  deltas: CollectiveMapDelta[],
  t: number,
): void {
  let explored = 0;
  let frontierS = 0;
  for (const c of map.cells) {
    if (c.kind === "blocked" || c.kind === "target") {
      if (c.kind === "target") frontierS = Math.max(frontierS, c.s);
      continue;
    }
    if (c.s <= explorer.s + 1) {
      if (c.kind === "unexplored") {
        c.kind = "explored";
        deltas.push({ t, exploredUpToS: c.s, contributorId });
      }
      if (c.kind === "explored") explored++;
      frontierS = Math.max(frontierS, c.s);
    } else if (c.kind === "unexplored" && c.s <= explorer.s + CELL_STEP * 2) {
      c.kind = "frontier";
      frontierS = Math.max(frontierS, c.s);
    }
  }
  const total = map.cells.filter((c) => c.kind !== "blocked").length || 1;
  map.coverage = explored / total;
  map.frontierS = frontierS;
  void dt;
}

export function markRelayAnchors(map: TunnelMapState, relays: SimNode[]): void {
  for (const r of relays) {
    if (!r.isRelay) continue;
    for (const c of map.cells) {
      if (Math.abs(c.s - r.s) < CELL_STEP * 1.2) c.kind = "relay_anchor";
    }
  }
}

export function markStaleBeyondPartition(map: TunnelMapState, partitionS: number | null): void {
  if (partitionS == null) return;
  for (const c of map.cells) {
    if (c.s > partitionS && c.kind === "explored") c.kind = "stale";
  }
}
