import { useEffect, useMemo, useRef } from "react";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import type { SwarmMetricPoint } from "@/hooks/useStreamingMetric";

function median(sorted: number[]): number {
  if (!sorted.length) return 0;
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m]! : (sorted[m - 1]! + sorted[m]!) / 2;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

function buildPointFromView(view: VertexSwarmView, t: number): SwarmMetricPoint {
  const meshLinks = view.meshV2?.graph?.links ?? [];
  const latencies = meshLinks.map((l) => l.latencyMs).filter((x) => Number.isFinite(x));
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = median(sorted);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);

  let online = 0;
  let stale = 0;
  let isolated = 0;
  const staleSet = view.graph.stalePeers;
  for (const n of view.nodes) {
    if (n.offline) {
      isolated++;
      continue;
    }
    const hb = n.lastHeartbeatMs ?? view.nowMs;
    if (staleSet.has(n.nodeId) || view.nowMs - hb > 10_000) stale++;
    else online++;
  }

  const packetLossByDrone: Record<string, number> = {};
  for (const l of meshLinks) {
    packetLossByDrone[l.a] = Math.max(packetLossByDrone[l.a] ?? 0, l.loss01);
    packetLossByDrone[l.b] = Math.max(packetLossByDrone[l.b] ?? 0, l.loss01);
  }
  for (const e of view.graph.edges) {
    packetLossByDrone[e.a] = Math.max(packetLossByDrone[e.a] ?? 0, e.loss);
    packetLossByDrone[e.b] = Math.max(packetLossByDrone[e.b] ?? 0, e.loss);
  }

  const rewardTotal =
    view.ledgerTail.reduce((acc, ev) => {
      if (ev.eventType.includes("reward") || ev.eventType.includes("coordination")) return acc + 12;
      return acc + 2;
    }, 0) + view.tickCount * 1.5;

  return {
    t,
    peersOnline: online,
    peersStale: stale,
    peersIsolated: isolated,
    consensusP50: p50,
    consensusP95: p95,
    consensusP99: p99,
    rewardTotal,
    packetLossByDrone,
  };
}

/** Pushes derived metrics from the local simulator view at most every ``throttleMs`` (10 Hz default). */
export function useSwarmMetricsFromView(
  view: VertexSwarmView | null,
  pushPoint: (p: SwarmMetricPoint) => void,
  opts?: { throttleMs?: number; enabled?: boolean },
) {
  const throttleMs = opts?.throttleMs ?? 100;
  const enabled = opts?.enabled !== false;
  const lastRef = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    if (!enabled || !view) return;
    const id = window.setInterval(() => {
      const v = viewRef.current;
      if (!v) return;
      const now = performance.now();
      if (now - lastRef.current < throttleMs) return;
      lastRef.current = now;
      pushPoint(buildPointFromView(v, Date.now()));
    }, Math.max(16, Math.floor(throttleMs / 2)));
    return () => window.clearInterval(id);
  }, [enabled, view, pushPoint, throttleMs]);

  return useMemo(() => ({}), []);
}
