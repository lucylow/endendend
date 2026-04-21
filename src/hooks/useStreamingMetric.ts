import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SwarmMetricPoint = {
  t: number;
  peersOnline: number;
  peersStale: number;
  peersIsolated: number;
  consensusP50: number;
  consensusP95: number;
  consensusP99: number;
  rewardTotal: number;
  /** Per-drone packet loss (0–1) for stacked viz */
  packetLossByDrone: Record<string, number>;
};

const DEFAULT_WINDOW = 60;
const DEFAULT_THROTTLE_MS = 100; // 10 Hz cap (backend may send 20 Hz)

function pushWindow(prev: SwarmMetricPoint[], next: SwarmMetricPoint, max: number): SwarmMetricPoint[] {
  const merged = [...prev, next];
  return merged.length > max ? merged.slice(-max) : merged;
}

export type UseStreamingMetricOptions = {
  /** Max samples retained (sliding window). */
  windowSize?: number;
  /** Minimum ms between accepted samples (downsample). */
  throttleMs?: number;
  /** Optional WebSocket URL; expects JSON messages like `{ type: \"swarm_metrics\", ...payload }`. */
  wsUrl?: string | null;
  enabled?: boolean;
};

/**
 * Maintains a fixed-size sliding window of swarm metrics, optionally fed by WebSocket ``swarm_metrics``
 * events. All ingress paths are throttled to ``throttleMs`` (default 100 ms ≈ 10 Hz).
 */
export function useStreamingMetric(opts: UseStreamingMetricOptions = {}) {
  const windowSize = opts.windowSize ?? DEFAULT_WINDOW;
  const throttleMs = opts.throttleMs ?? DEFAULT_THROTTLE_MS;
  const enabled = opts.enabled !== false;
  const [points, setPoints] = useState<SwarmMetricPoint[]>([]);
  const [wsState, setWsState] = useState<"idle" | "connecting" | "open" | "error">("idle");
  const lastPushRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);

  const tryPush = useCallback(
    (p: SwarmMetricPoint) => {
      if (!enabled) return;
      const now = performance.now();
      if (now - lastPushRef.current < throttleMs) return;
      lastPushRef.current = now;
      setPoints((prev) => pushWindow(prev, p, windowSize));
    },
    [enabled, throttleMs, windowSize],
  );

  const clear = useCallback(() => setPoints([]), []);

  useEffect(() => {
    if (!opts.wsUrl || !enabled) {
      setWsState("idle");
      return;
    }
    let cancelled = false;
    const url = opts.wsUrl;
    setWsState("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => {
      if (!cancelled) setWsState("open");
    };
    ws.onerror = () => {
      if (!cancelled) setWsState("error");
    };
    ws.onclose = () => {
      if (!cancelled) setWsState((s) => (s === "open" ? "idle" : s));
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type?: string } & Partial<SwarmMetricPoint>;
        if (msg.type && msg.type !== "swarm_metrics") return;
        const t = typeof msg.t === "number" ? msg.t : Date.now();
        tryPush({
          t,
          peersOnline: Number(msg.peersOnline ?? 0),
          peersStale: Number(msg.peersStale ?? 0),
          peersIsolated: Number(msg.peersIsolated ?? 0),
          consensusP50: Number(msg.consensusP50 ?? 0),
          consensusP95: Number(msg.consensusP95 ?? 0),
          consensusP99: Number(msg.consensusP99 ?? 0),
          rewardTotal: Number(msg.rewardTotal ?? 0),
          packetLossByDrone:
            msg.packetLossByDrone && typeof msg.packetLossByDrone === "object" ? msg.packetLossByDrone : {},
        });
      } catch {
        /* ignore malformed */
      }
    };
    return () => {
      cancelled = true;
      ws.close();
      wsRef.current = null;
    };
  }, [opts.wsUrl, enabled, tryPush]);

  return useMemo(
    () => ({
      points,
      pushPoint: tryPush,
      clear,
      wsState,
    }),
    [points, tryPush, clear, wsState],
  );
}
