import { useEffect, useMemo, useRef } from "react";
import { useSwarmStore } from "@/store/swarmStore";
import { disposeSwarmWebSocket, getSwarmWebSocket } from "./SwarmWebSocketClient";
import type { SwarmStatusUpdate } from "@/types/websocket";
import { RealtimeSyncEngine } from "./RealtimeSyncEngine";
import { mergeTelemetryFromPeers } from "./mergePeerTelemetry";
import { parseSwarmWsUrls } from "./parseSwarmWsUrls";

function logRealtimeTelemetryError(phase: string, err: unknown) {
  if (!import.meta.env.DEV) return;
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[useSwarmRealtime] ${phase}:`, msg);
}

export interface UseSwarmRealtimeOptions {
  /** When true, tear down sockets when the hook unmounts (single-page viz). */
  disposeOnUnmount?: boolean;
}

function resolveUrls(override?: string | string[]): string[] {
  if (override === undefined) return parseSwarmWsUrls();
  if (Array.isArray(override)) return override.length > 0 ? override : parseSwarmWsUrls();
  return [override];
}

/**
 * Subscribes to one or more telemetry gateways, merges frames (multi-peer),
 * and writes into {@link useSwarmStore} (`swarmWs` includes peer + conflict hints).
 */
export function useSwarmRealtime(urlOverride?: string | string[], options: UseSwarmRealtimeOptions = {}) {
  const { disposeOnUnmount = true } = options;

  const updateAgentsBatch = useSwarmStore((s) => s.updateAgentsBatch);
  const applySwarmStatusUpdate = useSwarmStore((s) => s.applySwarmStatusUpdate);
  const pushEdgeLatencyEvent = useSwarmStore((s) => s.pushEdgeLatencyEvent);
  const setSwarmWsMetrics = useSwarmStore((s) => s.setSwarmWsMetrics);
  const setRealtimeTelemetryActive = useSwarmStore((s) => s.setRealtimeTelemetryActive);
  const swarmWs = useSwarmStore((s) => s.swarmWs);

  const syncEngine = useMemo(() => new RealtimeSyncEngine(), []);
  const urlsRef = useRef<string[]>([]);
  const flushTicksRef = useRef<number[]>([]);
  const urlsDep =
    urlOverride === undefined
      ? "__default__"
      : Array.isArray(urlOverride)
        ? urlOverride.join("|")
        : urlOverride;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- urlsDep is a stable serialization of urlOverride
  const urls = useMemo(() => resolveUrls(urlOverride), [urlsDep]);

  useEffect(() => {
    urlsRef.current = urls;
  }, [urls]);

  useEffect(() => {
    if (urls.length <= 1) {
      const u = urls[0] ?? parseSwarmWsUrls()[0];
      setSwarmWsMetrics({
        telemetryPeerUrls: [u],
        telemetryPeersConnected: 0,
        telemetryMergeConflict: false,
      });

      const client = getSwarmWebSocket(u);

      const agentSub = client.agentUpdates$.subscribe((telemetry) => {
        if (telemetry.length === 0) return;
        try {
          setRealtimeTelemetryActive(true);
          const existing = useSwarmStore.getState().agents;
          const next = syncEngine.processTelemetry(telemetry, existing);
          updateAgentsBatch(next);
          setSwarmWsMetrics({
            connectionStatus: "connected",
            latencyMs: syncEngine.averageLatencyMs,
            messagesPerSec: syncEngine.messagesPerSecond,
            telemetryPeerUrls: [u],
            telemetryPeersConnected: 1,
            telemetryMergeConflict: false,
          });
        } catch (err) {
          logRealtimeTelemetryError("single-peer telemetry", err);
        }
      });

      const statusSub = client.swarmStatus$.subscribe((status) => {
        if (status?.type === "swarm_status") {
          try {
            applySwarmStatusUpdate(status as SwarmStatusUpdate);
          } catch (err) {
            logRealtimeTelemetryError("swarm_status", err);
          }
        }
      });

      const edgeSub = client.edgeLatency$.subscribe((ev) => {
        if (!ev) return;
        try {
          pushEdgeLatencyEvent(ev);
        } catch (err) {
          logRealtimeTelemetryError("edge_latency", err);
        }
      });

      const connSub = client.connectionStatus$.subscribe((st) => {
        setSwarmWsMetrics({
          connectionStatus: st,
          telemetryPeersConnected: st === "connected" ? 1 : 0,
          telemetryPeerUrls: [u],
        });
        if (st === "disconnected") {
          setRealtimeTelemetryActive(false);
          setSwarmWsMetrics({ latencyMs: 0, messagesPerSec: 0 });
        }
      });

      return () => {
        agentSub.unsubscribe();
        statusSub.unsubscribe();
        edgeSub.unsubscribe();
        connSub.unsubscribe();
        setRealtimeTelemetryActive(false);
        if (disposeOnUnmount) disposeSwarmWebSocket(u);
      };
    }

    const clients = urls.map((endpoint) => getSwarmWebSocket(endpoint));
    const latest = new Map<number, AgentTelemetryBatch>();
    let raf = 0;
    flushTicksRef.current = [];

    type AgentTelemetryBatch = import("@/types/websocket").AgentTelemetry[];

    const flush = () => {
      raf = 0;
      try {
        const batches = urls.map((_, i) => latest.get(i) ?? []);
        const { merged, hasConflict } = mergeTelemetryFromPeers(batches);
        if (merged.length === 0) return;
        setRealtimeTelemetryActive(true);
        const existing = useSwarmStore.getState().agents;
        const next = syncEngine.processTelemetry(merged, existing);
        updateAgentsBatch(next);

        const now = Date.now();
        flushTicksRef.current.push(now);
        const cutoff = now - 1000;
        flushTicksRef.current = flushTicksRef.current.filter((t) => t > cutoff);

        const connected = clients.filter((c) => c.connectionStatus$.getValue() === "connected").length;
        setSwarmWsMetrics({
          connectionStatus: connected > 0 ? "connected" : "disconnected",
          latencyMs: syncEngine.averageLatencyMs,
          messagesPerSec: flushTicksRef.current.length,
          telemetryPeerUrls: urls,
          telemetryPeersConnected: connected,
          telemetryMergeConflict: hasConflict,
        });
      } catch (err) {
        logRealtimeTelemetryError("multi-peer flush", err);
      }
    };

    const scheduleFlush = () => {
      if (raf) return;
      raf = requestAnimationFrame(flush);
    };

    const subs = clients.flatMap((client, i) => {
      const a = client.agentUpdates$.subscribe((telemetry) => {
        if (telemetry.length > 0) latest.set(i, telemetry);
        else if (!latest.has(i)) latest.set(i, []);
        scheduleFlush();
      });
      const s = client.swarmStatus$.subscribe((status) => {
        if (status?.type === "swarm_status") {
          try {
            applySwarmStatusUpdate(status as SwarmStatusUpdate);
          } catch (err) {
            logRealtimeTelemetryError("swarm_status", err);
          }
        }
      });
      const e = client.edgeLatency$.subscribe((ev) => {
        if (!ev) return;
        try {
          pushEdgeLatencyEvent(ev);
        } catch (err) {
          logRealtimeTelemetryError("edge_latency", err);
        }
      });
      const c = client.connectionStatus$.subscribe(() => {
        const connected = clients.filter((cl) => cl.connectionStatus$.getValue() === "connected").length;
        setSwarmWsMetrics({
          telemetryPeersConnected: connected,
          telemetryPeerUrls: urls,
          connectionStatus: connected > 0 ? "connected" : "disconnected",
        });
        if (connected === 0) {
          setRealtimeTelemetryActive(false);
          setSwarmWsMetrics({ latencyMs: 0, messagesPerSec: 0 });
        }
      });
      return [a, s, e, c];
    });

    setSwarmWsMetrics({
      telemetryPeerUrls: urls,
      telemetryPeersConnected: 0,
      telemetryMergeConflict: false,
    });

    return () => {
      subs.forEach((s) => s.unsubscribe());
      if (raf) cancelAnimationFrame(raf);
      setRealtimeTelemetryActive(false);
      flushTicksRef.current = [];
      if (disposeOnUnmount) urls.forEach((u) => disposeSwarmWebSocket(u));
    };
  }, [
    urls,
    syncEngine,
    updateAgentsBatch,
    applySwarmStatusUpdate,
    pushEdgeLatencyEvent,
    setSwarmWsMetrics,
    setRealtimeTelemetryActive,
    disposeOnUnmount,
  ]);

  const primaryUrl = urls[0] ?? parseSwarmWsUrls()[0];

  return {
    connectionStatus: swarmWs.connectionStatus,
    latencyMs: swarmWs.latencyMs,
    messagesPerSec: swarmWs.messagesPerSec,
    telemetryPeersConnected: swarmWs.telemetryPeersConnected,
    telemetryMergeConflict: swarmWs.telemetryMergeConflict,
    sendCommand: (command: unknown) => {
      urlsRef.current.forEach((u) => getSwarmWebSocket(u).sendCommand(command));
    },
    reconnect: () => {
      urlsRef.current.forEach((u) => getSwarmWebSocket(u).reconnect());
    },
    /** First URL (or only URL) for legacy call sites. */
    primaryEndpoint: primaryUrl,
  };
}
