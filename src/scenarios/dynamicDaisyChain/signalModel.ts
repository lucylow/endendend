import type { TunnelGeometry } from "./types";
import type { MissionPhase } from "./types";
import type { SimNode } from "./types";
import type { SignalHop } from "./types";

export function segmentLossMul(geom: TunnelGeometry, s: number): number {
  let m = 1;
  for (const seg of geom.segments) {
    if (s >= seg.startS && s <= seg.endS) {
      m *= seg.attenuationMul;
      if (seg.blocked) m *= 1.35;
    }
  }
  for (const z of geom.signalShadowZones) {
    if (s >= z.startS && s <= z.endS) m *= 1 + z.lossAdd;
  }
  return m;
}

/** Free-space-ish attenuation between two tunnel positions (no relays). */
export function directLinkQuality(
  geom: TunnelGeometry,
  sFrom: number,
  sTo: number,
  rng: () => number,
  noiseAmp: number,
): { loss: number; latencySec: number; jitterMs: number } {
  const d = Math.abs(sFrom - sTo);
  const depthMean = (sFrom + sTo) / 2;
  const depthPenalty = Math.min(0.92, (depthMean / geom.lengthM) ** 1.35 * 0.95);
  const segMul = Math.sqrt(segmentLossMul(geom, sFrom) * segmentLossMul(geom, sTo));
  const distLoss = 1 - Math.exp(-d / (geom.lengthM * 0.28));
  const jitterMs = 4 + d * 0.06 + rng() * noiseAmp * 40;
  const flutter = (rng() - 0.5) * 0.06 * noiseAmp;
  const loss = Math.min(0.97, 0.04 + distLoss * 0.55 * segMul + depthPenalty * 0.55 + flutter);
  const latencySec = 0.002 + d / 150000 + depthPenalty * 0.04 + rng() * 0.012 * noiseAmp;
  return { loss, latencySec, jitterMs: Math.max(0, jitterMs) };
}

export function missionPhaseFromIngress(ingressQuality: number, partitioned: boolean): MissionPhase {
  if (partitioned) return "partitioned";
  if (ingressQuality > 0.82) return "stable";
  if (ingressQuality > 0.62) return "weakening";
  if (ingressQuality > 0.38) return "intermittent";
  return "relay_dependent";
}

/** Build hop metrics along ordered chain entrance → relays → lead (IDs only). */
export function signalHopsAlongChain(
  orderedIds: string[],
  nodeById: Map<string, SimNode>,
  geom: TunnelGeometry,
  rng: () => number,
  noiseAmp: number,
): SignalHop[] {
  const hops: SignalHop[] = [];
  for (let i = 0; i < orderedIds.length - 1; i++) {
    const a = nodeById.get(orderedIds[i]);
    const b = nodeById.get(orderedIds[i + 1]);
    if (!a || !b) continue;
    const q = directLinkQuality(geom, a.s, b.s, rng, noiseAmp);
    const boostedByRelay = a.isRelay || b.isRelay;
    const loss = boostedByRelay ? Math.max(0, q.loss - 0.04 * (a.forwardLoad + b.forwardLoad) * 0.5) : q.loss;
    hops.push({
      fromId: orderedIds[i],
      toId: orderedIds[i + 1],
      loss: Math.min(0.97, loss),
      latencySec: q.latencySec * (boostedByRelay ? 0.85 : 1),
      jitterMs: q.jitterMs,
      boostedByRelay,
    });
  }
  return hops;
}

export function endToEndQuality(hops: SignalHop[]): number {
  if (!hops.length) return 0;
  let prod = 1;
  for (const h of hops) {
    prod *= Math.max(0.03, 1 - h.loss);
  }
  return Math.pow(prod, 1 / hops.length);
}
