import type { MeshMessageEnvelope, MeshEnvelopeDeliveryStatus } from "./types";

let serial = 1;

function simpleChecksum(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function createMeshEnvelope(args: {
  sender: string;
  receiver: string | "broadcast";
  topic: string;
  timestamp: number;
  missionId: string;
  sequence: number;
  payload: unknown;
  sourceLabel?: MeshMessageEnvelope["sourceLabel"];
}): MeshMessageEnvelope {
  const payloadJson = JSON.stringify(args.payload);
  return {
    messageId: `m-${args.missionId}-${serial++}`,
    sender: args.sender,
    receiver: args.receiver,
    topic: args.topic,
    timestamp: args.timestamp,
    missionId: args.missionId,
    sequence: args.sequence,
    retryCount: 0,
    pathTaken: [args.sender],
    deliveryStatus: "pending",
    checksum: simpleChecksum(payloadJson + args.topic + args.sequence),
    sourceLabel: args.sourceLabel ?? "mesh",
    payloadJson,
  };
}

export function markEnvelope(e: MeshMessageEnvelope, status: MeshEnvelopeDeliveryStatus, path?: string[]): MeshMessageEnvelope {
  return {
    ...e,
    deliveryStatus: status,
    pathTaken: path ?? e.pathTaken,
    retryCount: status === "delivered" ? e.retryCount : e.retryCount,
  };
}
