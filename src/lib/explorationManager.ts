import {
  FOXMQ_COMMIT_INTERVAL_MS,
  FOXMQ_CAS_MAX_ATTEMPTS,
  FOXMQ_WORLD_MAP_KEY,
} from "@/config/foxmq";
import type { FoxMQClient } from "@/lib/foxmqClient";
import type { GridCell } from "@/types";

const log = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.debug("[ExplorationManager]", ...args);
};

export type CellTuple = [number, number];

function keyOf(cell: CellTuple): string {
  return `${cell[0]},${cell[1]}`;
}

function parseKey(k: string): CellTuple | null {
  const [r, c] = k.split(",").map(Number);
  if (Number.isFinite(r) && Number.isFinite(c)) return [r, c];
  return null;
}

/**
 * Maintains local exploration state and syncs the shared world map via FoxMQ
 * (batched commits + CAS merge + subscription).
 */
export class ExplorationManager {
  private readonly foxmq: FoxMQClient;
  private readonly onCellsUpdated: (cells: Set<string>) => void;
  private mapExplored = new Set<string>();
  private dirtyCells = new Set<string>();
  private lastCommit = 0;
  private lock = false;

  constructor(foxmq: FoxMQClient, onCellsUpdated: (merged: Set<string>) => void) {
    this.foxmq = foxmq;
    this.onCellsUpdated = onCellsUpdated;
    this.foxmq.subscribe(FOXMQ_WORLD_MAP_KEY, (_k, value) => {
      this.onMapUpdate(value);
    });
    this.loadInitial();
  }

  private loadInitial(): void {
    const cells = this.foxmq.get<CellTuple[]>(FOXMQ_WORLD_MAP_KEY, []);
    const s = new Set(cells.map(keyOf));
    this.mapExplored = s;
    this.onCellsUpdated(new Set(this.mapExplored));
    log(`loaded ${s.size} cells from FoxMQ`);
  }

  getExploredKeys(): ReadonlySet<string> {
    return this.mapExplored;
  }

  /** Mark a grid cell explored locally; included in next batch commit. */
  markExplored(row: number, col: number, _agentId: string): void {
    const k = keyOf([row, col]);
    if (this.mapExplored.has(k)) return;
    this.mapExplored.add(k);
    this.dirtyCells.add(k);
  }

  private onMapUpdate(value: unknown): void {
    if (value == null || !Array.isArray(value)) return;
    const tuples = value as CellTuple[];
    const newSet = new Set(tuples.map(keyOf));
    this.mapExplored = newSet;
    for (const k of [...this.dirtyCells]) {
      if (newSet.has(k)) this.dirtyCells.delete(k);
    }
    this.onCellsUpdated(new Set(this.mapExplored));
    log(`remote map update: ${newSet.size} cells`);
  }

  commitUpdates(token?: string): void {
    if (this.lock || !this.dirtyCells.size) return;
    const toCommit = [...this.dirtyCells].map(parseKey).filter(Boolean) as CellTuple[];
    if (!toCommit.length) return;

    this.lock = true;
    try {
      try {
        for (let attempt = 0; attempt < FOXMQ_CAS_MAX_ATTEMPTS; attempt++) {
          const current = this.foxmq.get<CellTuple[]>(FOXMQ_WORLD_MAP_KEY, []);
          const currentSet = new Set(current.map(keyOf));
          const newCellsSet = new Set(toCommit.map(keyOf));
          const merged = new Set([...currentSet, ...newCellsSet]);
          const nextList: CellTuple[] = [...merged].map(parseKey).filter(Boolean) as CellTuple[];

          const ok = this.foxmq.compareAndSwap(
            FOXMQ_WORLD_MAP_KEY,
            current,
            nextList,
            { token },
          );
          if (ok) {
            for (const k of newCellsSet) this.dirtyCells.delete(k);
            this.mapExplored = merged;
            this.onCellsUpdated(new Set(this.mapExplored));
            log(`committed ${newCellsSet.size} new cells (total ${merged.size})`);
            return;
          }
          const fresh = this.foxmq.get<CellTuple[]>(FOXMQ_WORLD_MAP_KEY, []);
          this.mapExplored = new Set(fresh.map(keyOf));
          this.onCellsUpdated(new Set(this.mapExplored));
        }
        log("CAS commit exhausted retries");
      } catch (e) {
        log("commit aborted", e);
      }
    } finally {
      this.lock = false;
    }
  }

  /** Call from simulation tick with monotonic time (ms). */
  update(now: number, token?: string): void {
    if (now - this.lastCommit >= FOXMQ_COMMIT_INTERVAL_MS) {
      this.commitUpdates(token);
      this.lastCommit = now;
    }
  }

  resetLocal(): void {
    this.dirtyCells.clear();
    this.mapExplored = new Set();
    this.lastCommit = 0;
  }
}

export function applyExploredKeysToGrid(
  grid: GridCell[][],
  explored: Set<string>,
  searchedByAgentId: string | null,
): GridCell[][] {
  return grid.map((row) =>
    row.map((cell) => {
      const k = keyOf([cell.row, cell.col]);
      if (!explored.has(k)) return cell;
      if (cell.searched) return cell;
      return {
        ...cell,
        searched: true,
        searchedBy: searchedByAgentId ?? "foxmq-collective",
        timestamp: Date.now(),
      };
    }),
  );
}

export function explorationProgressPercent(grid: GridCell[][]): number {
  const flat = grid.flat();
  if (!flat.length) return 0;
  return (flat.filter((c) => c.searched).length / flat.length) * 100;
}
