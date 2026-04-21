import type { FoxMqMapEnvelope } from "./types";

export function markEnvelopeAcked(env: FoxMqMapEnvelope): FoxMqMapEnvelope {
  return { ...env, deliveryStatus: "acked" };
}

export function markEnvelopeDropped(env: FoxMqMapEnvelope): FoxMqMapEnvelope {
  return { ...env, deliveryStatus: "dropped" };
}
