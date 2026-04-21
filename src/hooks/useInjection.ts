import { useCallback, useState } from "react";

export type InjectionApiState = {
  lastAction: string | null;
  busy: boolean;
  error: string | null;
};

function baseUrl(): string {
  const b = import.meta.env.VITE_INJECTION_API_BASE as string | undefined;
  return (b && b.replace(/\/$/, "")) || "";
}

async function postJson(path: string, body: Record<string, unknown> = {}): Promise<void> {
  const root = baseUrl();
  if (!root) throw new Error("VITE_INJECTION_API_BASE is not set");
  const url = `${root}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `HTTP ${res.status}`);
  }
}

/**
 * HTTP failure injection mirroring ``demo/injection_ui.py`` when ``VITE_INJECTION_API_BASE`` is configured.
 * Callers should fall back to local simulator hooks when this returns false from ``httpEnabled``.
 */
export function useInjection() {
  const httpEnabled = Boolean(baseUrl());
  const [state, setState] = useState<InjectionApiState>({ lastAction: null, busy: false, error: null });

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      await fn();
      setState({ lastAction: label, busy: false, error: null });
    } catch (e) {
      setState({
        lastAction: label,
        busy: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  const killDrone = useCallback(
    (nodeId: string) => run(`Kill ${nodeId}`, () => postJson("/inject/kill/", { node_id: nodeId, target: nodeId })),
    [run],
  );

  const restoreDrone = useCallback(
    (nodeId: string) => run(`Restore ${nodeId}`, () => postJson("/inject/restore/", { node_id: nodeId })),
    [run],
  );

  const setPacketLossPct = useCallback(
    (pct: number) => run(`Packet loss ${pct}%`, () => postJson("/stress/packet_loss/", { loss_percent: pct })),
    [run],
  );

  const setLatencyMs = useCallback(
    (ms: number) => run(`Latency +${ms} ms`, () => postJson("/stress/latency/", { latency_ms: ms })),
    [run],
  );

  const simulatePartition = useCallback(
    () => run("Partition", () => postJson("/stress/partition/", { group_a: [1, 2], group_b: [3, 4, 5] })),
    [run],
  );

  const resetAll = useCallback(() => run("Reset faults", () => postJson("/stress/reset/", {})), [run]);

  return {
    httpEnabled,
    ...state,
    killDrone,
    restoreDrone,
    setPacketLossPct,
    setLatencyMs,
    simulatePartition,
    resetAll,
  };
}
