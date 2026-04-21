import type { MapCellMeta } from "@/swarm/types";
import type { DistributedMemoryCommitStatus, DistributedMemoryEventType } from "./types";

export type MapLedgerEvent = {
  eventId: string;
  nodeId: string;
  eventType: DistributedMemoryEventType;
  affectedCells: string[];
  previousHash?: string;
  mapVersion?: number;
  relayRoute: string[];
  commitStatus: DistributedMemoryCommitStatus;
  timestamp: number;
  payload?: Record<string, unknown>;
};

function hashString(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export class MapEventLedger {
  private events: MapLedgerEvent[] = [];
  private seq = 1;

  append(ev: Omit<MapLedgerEvent, "eventId" | "timestamp"> & { timestamp?: number }): MapLedgerEvent {
    const eventId = `fox-${this.seq++}-${hashString(JSON.stringify(ev)).slice(0, 8)}`;
    const full: MapLedgerEvent = {
      ...ev,
      eventId,
      timestamp: ev.timestamp ?? Date.now(),
    };
    this.events.push(full);
    if (this.events.length > 2000) this.events.splice(0, this.events.length - 2000);
    return full;
  }

  tail(n = 80): MapLedgerEvent[] {
    return this.events.slice(-n);
  }

  all(): MapLedgerEvent[] {
    return [...this.events];
  }

  reset(): void {
    this.events = [];
    this.seq = 1;
  }
}

export function cellsTouchedFromRecord(cells: Record<string, MapCellMeta>): string[] {
  return Object.keys(cells);
}
