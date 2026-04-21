import type { FoxMqDeliveryStatus, FoxMqMapEnvelope, FoxMqMessageKind } from "./types";

let seqCounter = 1;

export function nextFoxSequence(): number {
  return seqCounter++;
}

export function resetFoxSequence(n = 1): void {
  seqCounter = n;
}

function stableChecksum(payload: unknown, version: number, ts: number): string {
  const blob = `${version}|${ts}|${JSON.stringify(payload)}`;
  let h = 2166136261;
  for (let i = 0; i < blob.length; i++) {
    h ^= blob.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function buildEnvelope(args: {
  messageType: FoxMqMessageKind;
  sender: string;
  recipient?: string;
  missionId: string;
  mapId: string;
  version: number;
  payload: unknown;
  timestamp: number;
  deliveryStatus?: FoxMqDeliveryStatus;
}): FoxMqMapEnvelope {
  const checksum = stableChecksum(args.payload, args.version, args.timestamp);
  return {
    messageType: args.messageType,
    sender: args.sender,
    recipient: args.recipient,
    missionId: args.missionId,
    mapId: args.mapId,
    version: args.version,
    sequence: nextFoxSequence(),
    checksum,
    timestamp: args.timestamp,
    deliveryStatus: args.deliveryStatus ?? "pending",
    payload: args.payload,
  };
}
