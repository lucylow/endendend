import type { SimTelemetrySample } from "./swarm-types";

/** Merge out-of-order telemetry; mark duplicates; monotonic sequence per node. */
export class TelemetryNormalizer {
  private lastSeq = new Map<string, number>();

  normalize(raw: SimTelemetrySample): SimTelemetrySample {
    const prev = this.lastSeq.get(raw.nodeId) ?? -1;
    const duplicate = raw.sequence <= prev;
    const seq = duplicate ? prev : raw.sequence;
    if (!duplicate) this.lastSeq.set(raw.nodeId, raw.sequence);
    return {
      ...raw,
      sequence: seq,
      duplicate,
      receivedAtMs: Math.max(raw.receivedAtMs, raw.emittedAtMs),
    };
  }

  reset(): void {
    this.lastSeq.clear();
  }
}
