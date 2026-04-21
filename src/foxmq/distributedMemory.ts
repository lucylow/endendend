import type { MapLedgerEvent } from "./mapLedger";
import type { DistributedMemoryCommitStatus } from "./types";

export type DistributedMemoryRecord = {
  recordId: string;
  eventId: string;
  nodeId: string;
  eventType: MapLedgerEvent["eventType"];
  affectedCells: string[];
  previousHash?: string;
  mapVersion?: number;
  relayRoute: string[];
  commitStatus: DistributedMemoryCommitStatus;
  timestamp: number;
};

export function ledgerEventToMemoryRecord(ev: MapLedgerEvent): DistributedMemoryRecord {
  return {
    recordId: `mem-${ev.eventId}`,
    eventId: ev.eventId,
    nodeId: ev.nodeId,
    eventType: ev.eventType,
    affectedCells: ev.affectedCells,
    previousHash: ev.previousHash,
    mapVersion: ev.mapVersion,
    relayRoute: ev.relayRoute,
    commitStatus: ev.commitStatus,
    timestamp: ev.timestamp,
  };
}
