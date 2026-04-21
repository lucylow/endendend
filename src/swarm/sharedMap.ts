import type { MapCellMeta, MapCellState, SharedMapDelta } from "./types";

/** Preference when ranks tie: target > blocked > safe > searched > seen > frontier > unknown */
const CELL_RANK: Record<MapCellState, number> = {
  unknown: 0,
  frontier: 1,
  seen: 2,
  searched: 3,
  safe: 4,
  blocked: 5,
  target: 6,
};

function cellKey(gx: number, gz: number): string {
  return `${gx},${gz}`;
}

export function parseCellKey(key: string): { gx: number; gz: number } | null {
  const [a, b] = key.split(",").map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { gx: a, gz: b };
}

/** Deterministic merge: higher rank wins; equal rank uses higher version, then newer timestamp. */
export function mergeCellMeta(local: MapCellMeta | undefined, remote: MapCellMeta): MapCellMeta {
  if (!local) return { ...remote };
  const lr = CELL_RANK[local.state];
  const rr = CELL_RANK[remote.state];
  if (rr > lr) return { ...remote };
  if (rr < lr) return { ...local };
  if (remote.version > local.version) return { ...remote };
  if (remote.version < local.version) return { ...local };
  if (remote.updatedAtMs > local.updatedAtMs) return { ...remote };
  return { ...local };
}

export class MonotonicSharedMap {
  private cells = new Map<string, MapCellMeta>();
  private seq = 1;

  constructor(initial?: Record<string, MapCellMeta>) {
    if (initial) {
      for (const [k, v] of Object.entries(initial)) {
        this.cells.set(k, { ...v });
      }
    }
  }

  nextVersion(): number {
    const v = this.seq;
    this.seq += 1;
    return v;
  }

  getCell(key: string): MapCellMeta | undefined {
    return this.cells.get(key);
  }

  /** World coords to grid (4m cells — matches simulator motion scale). */
  static worldToGrid(x: number, z: number, cellM = 4): { gx: number; gz: number } {
    return { gx: Math.round(x / cellM), gz: Math.round(z / cellM) };
  }

  applyLocalUpdate(
    gx: number,
    gz: number,
    state: MapCellState,
    nowMs: number,
    nodeId: string,
    confidence01?: number,
  ): string {
    const key = cellKey(gx, gz);
    const v = this.nextVersion();
    const next: MapCellMeta = {
      state,
      version: v,
      updatedAtMs: nowMs,
      lastNodeId: nodeId,
      ...(confidence01 != null ? { confidence01 } : {}),
    };
    const merged = mergeCellMeta(this.cells.get(key), next);
    this.cells.set(key, merged);
    return key;
  }

  /** Merge remote delta — CRDT-style monotonic join. */
  mergeDelta(delta: SharedMapDelta): { changedKeys: string[] } {
    const changed: string[] = [];
    for (const [k, remote] of Object.entries(delta.cells)) {
      const prev = this.cells.get(k);
      const merged = mergeCellMeta(prev, remote);
      if (!prev || merged.state !== prev.state || merged.version !== prev.version) {
        changed.push(k);
        this.cells.set(k, merged);
        this.seq = Math.max(this.seq, merged.version + 1);
      }
    }
    return { changedKeys: changed };
  }

  recomputeFrontiers(nowMs: number, originNodeId = "mesh"): void {
    const keys = [...this.cells.keys()];
    const isExplored = (k: string) => {
      const c = this.cells.get(k);
      return c && (c.state === "searched" || c.state === "safe" || c.state === "target" || c.state === "blocked");
    };
    const neighbors = (gx: number, gz: number) => [
      cellKey(gx + 1, gz),
      cellKey(gx - 1, gz),
      cellKey(gx, gz + 1),
      cellKey(gx, gz - 1),
    ];
    for (const k of keys) {
      const cur = this.cells.get(k);
      if (!cur || !isExplored(k)) continue;
      const p = parseCellKey(k);
      if (!p) continue;
      for (const nk of neighbors(p.gx, p.gz)) {
        const n = this.cells.get(nk);
        if (!n || n.state === "unknown") {
          const q = parseCellKey(nk);
          if (!q) continue;
          this.applyLocalUpdate(q.gx, q.gz, "frontier", nowMs, originNodeId);
        }
      }
    }
  }

  snapshotCells(): Record<string, MapCellMeta> {
    const out: Record<string, MapCellMeta> = {};
    for (const [k, v] of this.cells) out[k] = { ...v };
    return out;
  }

  coverageStats(): {
    total: number;
    explored: number;
    frontier: number;
    target: number;
    coverage01: number;
  } {
    let explored = 0;
    let frontier = 0;
    let target = 0;
    let total = this.cells.size || 1;
    for (const c of this.cells.values()) {
      if (c.state === "frontier") frontier += 1;
      if (c.state === "target") target += 1;
      if (c.state === "searched" || c.state === "safe" || c.state === "target") explored += 1;
    }
    const coverage01 = Math.min(1, explored / Math.max(1, total - frontier * 0.25));
    return { total, explored, frontier, target, coverage01 };
  }

  frontierKeys(): string[] {
    const keys: string[] = [];
    for (const [k, c] of this.cells) {
      if (c.state === "frontier") keys.push(k);
    }
    return keys;
  }

  exportDelta(keys: string[], originNodeId: string, nowMs: number): SharedMapDelta {
    const cells: Record<string, MapCellMeta> = {};
    for (const k of keys) {
      const m = this.cells.get(k);
      if (m) cells[k] = { ...m };
    }
    return { cells, originNodeId, emittedAtMs: nowMs };
  }
}

export { cellKey, CELL_RANK };
