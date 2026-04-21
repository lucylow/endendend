import { createRng } from "./config";
import type { ScenarioVariantId, TunnelSegment, TunnelGeometry } from "./types";

function jitter(rng: () => number, base: number, spread: number): number {
  return base + (rng() - 0.5) * 2 * spread;
}

export function buildTunnelGeometry(variant: ScenarioVariantId["id"], seed: number): TunnelGeometry {
  const rng = createRng(seed ^ 0x9e3779b9);
  const lengthBase =
    variant === "deep" ? 260 : variant === "narrow" || variant === "collapsed" ? 140 : 195;
  const lengthM = jitter(rng, lengthBase, 12);
  const widthM = variant === "narrow" ? 2.1 + rng() * 0.4 : 3.2 + rng() * 0.6;

  const segments: TunnelSegment[] = [];
  let cursor = 0;
  const chunk = lengthM / (5 + Math.floor(rng() * 3));
  const labels = ["ingress", "choke_a", "mid_mine", "choke_b", "deep_shaft"];
  for (let i = 0; i < 5 && cursor < lengthM - 1; i++) {
    const end = Math.min(lengthM, cursor + chunk * (0.85 + rng() * 0.35));
    segments.push({
      id: labels[i] ?? `seg_${i}`,
      startS: cursor,
      endS: end,
      label: labels[i] ?? `seg_${i}`,
      attenuationMul: 1 + rng() * (variant === "collapsed" ? 0.45 : 0.22),
      blocked: variant === "collapsed" && i === 3 && rng() > 0.35,
    });
    cursor = end;
  }
  if (segments.length && segments[segments.length - 1].endS < lengthM) {
    const last = segments[segments.length - 1];
    segments.push({
      id: "terminal",
      startS: last.endS,
      endS: lengthM,
      label: "terminal",
      attenuationMul: 1.05 + rng() * 0.15,
      blocked: false,
    });
  }

  const collapsePoints: number[] = [];
  for (let i = 0; i < 3; i++) {
    collapsePoints.push(jitter(rng, lengthM * (0.25 + i * 0.22), 8));
  }

  const relayAnchorZones: TunnelGeometry["relayAnchorZones"] = [];
  for (let z = 0; z < 4; z++) {
    const center = lengthM * (0.18 + z * 0.2) + (rng() - 0.5) * 10;
    relayAnchorZones.push({
      id: `anchor_${z}`,
      startS: Math.max(0, center - 4 - rng() * 3),
      endS: Math.min(lengthM, center + 4 + rng() * 3),
    });
  }

  const signalShadowZones: TunnelGeometry["signalShadowZones"] = [];
  for (let s = 0; s < 2; s++) {
    const c = lengthM * (0.35 + s * 0.28);
    signalShadowZones.push({
      startS: c - 9,
      endS: c + 9,
      lossAdd: 0.08 + rng() * (variant === "noisy" ? 0.18 : 0.1),
    });
  }

  const frontierPoints: number[] = [];
  for (let f = 0; f < 5; f++) {
    frontierPoints.push(jitter(rng, lengthM * (0.12 + f * 0.16), 6));
  }

  const targetZones =
    variant === "target_rich"
      ? [
          { id: "victim_a", startS: lengthM * 0.55, endS: lengthM * 0.62 },
          { id: "victim_b", startS: lengthM * 0.72, endS: lengthM * 0.8 },
        ]
      : [{ id: "victim_zone", startS: lengthM * 0.68, endS: lengthM * 0.76 }];

  const checkpoints = [lengthM * 0.12, lengthM * 0.35, lengthM * 0.55];

  return {
    lengthM,
    widthM,
    entranceS: 0,
    segments,
    collapsePoints,
    relayAnchorZones,
    signalShadowZones,
    frontierPoints,
    targetZones,
    returnCheckpoints: checkpoints,
  };
}
