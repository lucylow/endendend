import type { EngineConfig, ScenarioVariantId, TunnelGeometry } from "./types";
import { buildTunnelGeometry } from "./tunnelGeometry";

export const DEFAULT_TICK_HZ = 20;

export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildEngineConfig(seed: number, variant: ScenarioVariantId["id"] = "default"): EngineConfig {
  const tunnel = buildTunnelGeometry(variant, seed);
  const depthMul = variant === "deep" ? 1.45 : variant === "narrow" ? 0.85 : 1;
  const noiseMul = variant === "noisy" || variant === "collapsed" ? 1.35 : 1;
  const relayHeavy = variant === "relay_heavy" ? 0.75 : 1;
  const targetRich = variant === "target_rich" ? 2.2 : 1;

  return {
    seed,
    tunnel,
    tickHz: DEFAULT_TICK_HZ,
    explorerSpeed: 1.15 * depthMul,
    followerCreep: 0.55 * depthMul,
    minRelaySpacingM: Math.max(6, 9 * relayHeavy),
    relayLossThreshold: 0.42 * noiseMul,
    partitionLossThreshold: 0.82 * noiseMul,
    batteryDrainExplorer: 0.018,
    batteryDrainRelay: 0.012,
    batteryDrainIdle: 0.004,
    targetDiscoveryChancePerSec: 0.0008 * targetRich,
    forcedRelayFailure: null,
  };
}

export function tunnelSummary(geom: TunnelGeometry): string {
  return `${geom.lengthM.toFixed(0)}m tunnel, ${geom.segments.length} segments, ${geom.relayAnchorZones.length} relay zones`;
}
