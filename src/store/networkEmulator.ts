/**
 * Depth / distance–based link model + Gilbert–Elliott bursts.
 * Optional per-link connectivity overrides for partitions & intermittent links.
 */
import type { PeerInfo } from "@/types/p2p";

export type LossModel = "depth_based" | "distance" | "constant";

export interface EmulatorConfig {
  lossModel: LossModel;
  baseLoss: number;
  burstEnabled: boolean;
  burstParams: {
    pGoodToBad: number;
    pBadToGood: number;
    lossInBad: number;
  };
  asymmetryThreshold: number;
  maxRange: number;
  latencyPerMeter: number;
  tunnelDepthMax: number;
}

export interface LinkQuality {
  sourceId: string;
  destId: string;
  distance: number;
  lossProbability: number;
  latencyMs: number;
  isBlocked: boolean;
  isOutOfRange: boolean;
}

export interface EmulatorMetrics {
  totalPackets: number;
  deliveredPackets: number;
  droppedPackets: number;
  avgLatency: number;
  burstDrops: number;
  asymmetryBlocks: number;
  rangeBlocks: number;
  matrixBlocks: number;
  deliveryRatio: number;
  linkQualities: LinkQuality[];
}

export type DeliveryReason =
  | "ok"
  | "random_drop"
  | "burst_drop"
  | "asymmetry_block"
  | "out_of_range"
  | "matrix_block";

export const DEFAULT_EMULATOR_CONFIG: EmulatorConfig = {
  lossModel: "depth_based",
  baseLoss: 0.02,
  burstEnabled: true,
  burstParams: {
    pGoodToBad: 0.12,
    pBadToGood: 0.18,
    lossInBad: 0.85,
  },
  asymmetryThreshold: 12,
  maxRange: 22,
  latencyPerMeter: 2.5,
  tunnelDepthMax: 120,
};

const connectivityMatrix = new Map<string, number>();

function linkKey(src: string, dst: string): string {
  return `${src}|${dst}`;
}

/** P(allow) for directed edge src→dst. Undefined = no override (use computed loss). */
export function setConnectivity(src: string, dst: string, probability: number): void {
  connectivityMatrix.set(linkKey(src, dst), Math.max(0, Math.min(1, probability)));
}

export function clearConnectivityMatrix(): void {
  connectivityMatrix.clear();
}

export function getConnectivity(src: string, dst: string): number | undefined {
  return connectivityMatrix.get(linkKey(src, dst));
}

export function createEmulatorMetrics(): EmulatorMetrics {
  return {
    totalPackets: 0,
    deliveredPackets: 0,
    droppedPackets: 0,
    avgLatency: 0,
    burstDrops: 0,
    asymmetryBlocks: 0,
    rangeBlocks: 0,
    matrixBlocks: 0,
    deliveryRatio: 0,
    linkQualities: [],
  };
}

export class GilbertElliottManager {
  private inBad = false;

  reset(): void {
    this.inBad = false;
  }

  /** Step burst state machine; returns effective extra loss multiplier in [0,1]. */
  step(config: EmulatorConfig): number {
    if (!config.burstEnabled) return 0;
    const { pGoodToBad, pBadToGood, lossInBad } = config.burstParams;
    if (this.inBad) {
      if (Math.random() < pBadToGood) this.inBad = false;
      return lossInBad;
    }
    if (Math.random() < pGoodToBad) this.inBad = true;
    return this.inBad ? lossInBad : 0;
  }

  isBadState(): boolean {
    return this.inBad;
  }
}

function dist3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function lossForLink(a: PeerInfo, b: PeerInfo, config: EmulatorConfig): number {
  const d = dist3(a.position, b.position);
  let loss = config.baseLoss;
  if (config.lossModel === "distance") {
    loss = Math.min(0.95, config.baseLoss + d * 0.008);
  } else if (config.lossModel === "depth_based") {
    const avgDepth = (a.depth + b.depth) / 2;
    const f = Math.min(1, avgDepth / config.tunnelDepthMax);
    loss = Math.min(0.92, config.baseLoss + f * 0.55 + d * 0.004);
  } else {
    loss = config.baseLoss;
  }
  return loss;
}

function asymmetryBlocked(a: PeerInfo, b: PeerInfo, config: EmulatorConfig): boolean {
  return Math.abs(a.depth - b.depth) > config.asymmetryThreshold * 0.15 && Math.random() < 0.25;
}

export function computeAllLinkQualities(
  peers: Record<string, PeerInfo>,
  config: EmulatorConfig,
): LinkQuality[] {
  const list = Object.values(peers);
  const out: LinkQuality[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const src = list[i];
      const dst = list[j];
      const distance = dist3(src.position, dst.position);
      const isOutOfRange = distance > config.maxRange;
      const isBlocked = asymmetryBlocked(src, dst, config);
      let lossProbability = lossForLink(src, dst, config);
      const override = getConnectivity(src.nodeId, dst.nodeId);
      if (override !== undefined) {
        lossProbability = Math.min(0.99, 1 - override * (1 - lossProbability));
      }
      const latencyMs = config.latencyPerMeter * distance + 8 + src.depth * 0.15;
      out.push({
        sourceId: src.nodeId,
        destId: dst.nodeId,
        distance,
        lossProbability,
        latencyMs,
        isBlocked,
        isOutOfRange,
      });
    }
  }
  return out;
}

export function evaluatePacketDelivery(
  link: LinkQuality,
  burstManager: GilbertElliottManager,
  config: EmulatorConfig,
): { delivered: boolean; latencyMs: number; reason: DeliveryReason } {
  const matrixP = getConnectivity(link.sourceId, link.destId);
  if (matrixP !== undefined && matrixP <= 0) {
    return { delivered: false, latencyMs: 0, reason: "matrix_block" };
  }
  if (link.isOutOfRange) {
    return { delivered: false, latencyMs: 0, reason: "out_of_range" };
  }
  if (link.isBlocked) {
    return { delivered: false, latencyMs: 0, reason: "asymmetry_block" };
  }

  const burstExtra = burstManager.step(config);
  let p = link.lossProbability;
  if (burstExtra > 0) {
    p = Math.min(0.99, p + burstExtra * (1 - p));
  }
  if (matrixP !== undefined) {
    p = Math.min(0.99, 1 - matrixP * (1 - p));
  }

  if (Math.random() < p) {
    return {
      delivered: false,
      latencyMs: 0,
      reason: burstExtra > 0.5 ? "burst_drop" : "random_drop",
    };
  }

  const jitter = (Math.random() - 0.5) * 6;
  return { delivered: true, latencyMs: Math.max(1, link.latencyMs + jitter), reason: "ok" };
}

export function generateDegradationZones(config: EmulatorConfig): Array<{
  depth: number;
  loss: string;
  lossValue: number;
  latency: string;
  status: "excellent" | "good" | "degraded" | "critical" | "blackout";
}> {
  const rows: Array<{
    depth: number;
    loss: string;
    lossValue: number;
    latency: string;
    status: "excellent" | "good" | "degraded" | "critical" | "blackout";
  }> = [];
  const steps = 8;
  for (let s = 0; s < steps; s++) {
    const depth = Math.round((config.tunnelDepthMax / steps) * (s + 1));
    const f = depth / config.tunnelDepthMax;
    const lossValue = Math.min(0.95, config.baseLoss + f * 0.55);
    const lat = 20 + f * 180;
    let status: (typeof rows)[0]["status"] = "good";
    if (lossValue < 0.08) status = "excellent";
    else if (lossValue < 0.22) status = "good";
    else if (lossValue < 0.45) status = "degraded";
    else if (lossValue < 0.72) status = "critical";
    else status = "blackout";
    rows.push({
      depth,
      loss: `${(lossValue * 100).toFixed(0)}%`,
      lossValue,
      latency: `${lat.toFixed(0)}ms`,
      status,
    });
  }
  return rows;
}
