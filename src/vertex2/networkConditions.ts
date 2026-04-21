import type { NetworkConditionVector, NetworkStressMode } from "./types";
import { clamp01 } from "./normalizers";

export function baselineVector(mode: NetworkStressMode): NetworkConditionVector {
  switch (mode) {
    case "normal":
      return {
        baseLatencyMs: 35,
        jitterMs: 12,
        loss01: 0.04,
        dup01: 0.02,
        reorder01: 0.01,
        ackDelayMs: 20,
        timeoutChance01: 0.02,
        staleDelivery01: 0.01,
        retransmitPressure01: 0.08,
        routeInstability01: 0.05,
      };
    case "degraded":
      return {
        baseLatencyMs: 90,
        jitterMs: 40,
        loss01: 0.12,
        dup01: 0.05,
        reorder01: 0.06,
        ackDelayMs: 70,
        timeoutChance01: 0.08,
        staleDelivery01: 0.07,
        retransmitPressure01: 0.22,
        routeInstability01: 0.18,
      };
    case "high_latency":
      return {
        baseLatencyMs: 260,
        jitterMs: 120,
        loss01: 0.06,
        dup01: 0.03,
        reorder01: 0.04,
        ackDelayMs: 180,
        timeoutChance01: 0.12,
        staleDelivery01: 0.05,
        retransmitPressure01: 0.28,
        routeInstability01: 0.22,
      };
    case "lossy":
      return {
        baseLatencyMs: 55,
        jitterMs: 25,
        loss01: 0.28,
        dup01: 0.12,
        reorder01: 0.1,
        ackDelayMs: 55,
        timeoutChance01: 0.18,
        staleDelivery01: 0.12,
        retransmitPressure01: 0.45,
        routeInstability01: 0.25,
      };
    case "partitioned":
      return {
        baseLatencyMs: 140,
        jitterMs: 60,
        loss01: 0.22,
        dup01: 0.08,
        reorder01: 0.12,
        ackDelayMs: 120,
        timeoutChance01: 0.22,
        staleDelivery01: 0.18,
        retransmitPressure01: 0.5,
        routeInstability01: 0.55,
      };
    case "recovery":
      return {
        baseLatencyMs: 80,
        jitterMs: 35,
        loss01: 0.09,
        dup01: 0.04,
        reorder01: 0.05,
        ackDelayMs: 60,
        timeoutChance01: 0.07,
        staleDelivery01: 0.06,
        retransmitPressure01: 0.3,
        routeInstability01: 0.2,
      };
    case "offline":
      return {
        baseLatencyMs: 420,
        jitterMs: 160,
        loss01: 0.45,
        dup01: 0.06,
        reorder01: 0.08,
        ackDelayMs: 260,
        timeoutChance01: 0.35,
        staleDelivery01: 0.22,
        retransmitPressure01: 0.62,
        routeInstability01: 0.4,
      };
    default:
      return baselineVector("normal");
  }
}

export function mergeVectors(a: NetworkConditionVector, b: Partial<NetworkConditionVector>): NetworkConditionVector {
  return {
    baseLatencyMs: b.baseLatencyMs ?? a.baseLatencyMs,
    jitterMs: b.jitterMs ?? a.jitterMs,
    loss01: clamp01(b.loss01 ?? a.loss01),
    dup01: clamp01(b.dup01 ?? a.dup01),
    reorder01: clamp01(b.reorder01 ?? a.reorder01),
    ackDelayMs: b.ackDelayMs ?? a.ackDelayMs,
    timeoutChance01: clamp01(b.timeoutChance01 ?? a.timeoutChance01),
    staleDelivery01: clamp01(b.staleDelivery01 ?? a.staleDelivery01),
    retransmitPressure01: clamp01(b.retransmitPressure01 ?? a.retransmitPressure01),
    routeInstability01: clamp01(b.routeInstability01 ?? a.routeInstability01),
  };
}

export type NetworkConditionController = {
  readonly mode: NetworkStressMode;
  manualBias: Partial<NetworkConditionVector>;
  setMode(m: NetworkStressMode): void;
  injectLatency(deltaMs: number): void;
  injectLoss(delta01: number): void;
  resetManual(): void;
  vector(): NetworkConditionVector;
};

export function createNetworkConditionController(initial: NetworkStressMode): NetworkConditionController {
  let mode = initial;
  let manual: Partial<NetworkConditionVector> = {};
  return {
    get mode() {
      return mode;
    },
    get manualBias() {
      return manual;
    },
    setMode(m) {
      mode = m;
    },
    injectLatency(deltaMs) {
      manual.baseLatencyMs = (manual.baseLatencyMs ?? 0) + deltaMs;
      manual.jitterMs = (manual.jitterMs ?? 0) + Math.floor(deltaMs * 0.35);
    },
    injectLoss(delta01) {
      manual.loss01 = clamp01((manual.loss01 ?? 0) + delta01);
    },
    resetManual() {
      manual = {};
    },
    vector() {
      return mergeVectors(baselineVector(mode), manual);
    },
  };
}
