import { useMemo } from "react";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";

function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

/** Mock thermal field correlated with drone positions (hackathon demo). */
export function useThermalData(view: VertexSwarmView | null | undefined) {
  return useMemo(() => {
    if (!view) return { byNodeId: {} as Record<string, number>, fireFront: { x: 0, z: 0 } };
    const t = view.tickCount * 0.04;
    const fireFront = { x: Math.cos(t) * 8, z: Math.sin(t * 0.9) * 7 };
    const byNodeId: Record<string, number> = {};
    for (const n of view.nodes) {
      const dx = n.position.x - fireFront.x * 2.2;
      const dz = n.position.z - fireFront.z * 2.2;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const base = Math.max(0, 1 - dist / 22);
      const noise = hash01(`${n.nodeId}-${view.tickCount}`) * 0.12;
      byNodeId[n.nodeId] = Math.min(1, base * 0.92 + noise);
    }
    return { byNodeId, fireFront };
  }, [view, view?.tickCount, view?.nodes]);
}

/** Mock water depth (m) at each drone — smooth wave + position bias. */
export function useWaterDepth(view: VertexSwarmView | null | undefined) {
  return useMemo(() => {
    if (!view) return { byNodeId: {} as Record<string, number>, meanDepthM: 0 };
    const wave = Math.sin(view.tickCount * 0.06) * 0.35 + 1.1;
    const byNodeId: Record<string, number> = {};
    let sum = 0;
    for (const n of view.nodes) {
      const radial = (Math.hypot(n.position.x, n.position.z) / 24) * 1.4;
      const micro = hash01(n.nodeId) * 0.25;
      const d = Math.max(0, Math.min(5, wave + radial + micro - 0.6));
      byNodeId[n.nodeId] = Math.round(d * 10) / 10;
      sum += d;
    }
    return { byNodeId, meanDepthM: sum / Math.max(1, view.nodes.length) };
  }, [view, view?.tickCount, view?.nodes]);
}

/** Mock gas concentration ppm per drone. */
export function useGasReadings(view: VertexSwarmView | null | undefined) {
  return useMemo(() => {
    if (!view) return { byNodeId: {} as Record<string, number> };
    const byNodeId: Record<string, number> = {};
    for (const n of view.nodes) {
      const tel = view.telemetry.find((t) => t.nodeId === n.nodeId);
      const stress = (1 - (tel?.sensorConfidence01 ?? 0.7)) * 180;
      const base = hash01(`gas-${n.nodeId}`) * 220 + stress;
      byNodeId[n.nodeId] = Math.round(Math.min(500, Math.max(0, base)));
    }
    return { byNodeId };
  }, [view, view?.tickCount, view?.telemetry, view?.nodes]);
}
