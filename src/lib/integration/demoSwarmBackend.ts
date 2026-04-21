import type { SwarmBackendHealth, SwarmBackendSnapshot, SwarmTashiProjection } from "@/lib/tashi-sdk/swarmBackendTypes";

function demoTashi(): SwarmTashiProjection {
  const now = Date.now();
  return {
    mesh: {
      nodeId: "preview-node",
      swarmId: "lovable-preview",
      version: 42,
      updatedAtMs: now,
      role: "gateway",
      status: "healthy",
      depth: 3,
      peerCount: 6,
      taskCount: 2,
      alertCount: 0,
    },
    registers: { keys: ["mission.phase", "mesh.clock"], worldMap: {} },
    chainHint: {
      monotonicMeshVersion: 42,
      meshClockMs: now,
      storeMetrics: { preview: true },
    },
    missionsBrief: [
      { mission_id: "m-demo-1", name: "SAR lattice (preview)", status: "running" },
      { mission_id: "m-demo-2", name: "FoxMQ sync (preview)", status: "idle" },
    ],
    historyTail: [],
    sar: {
      missionPhase: "search",
      ledgerHead: "preview-ledger",
      vertexSequence: 128,
      latticeOnline: 4,
    },
  };
}

/** Minimal valid snapshot for dashboards when no gateway is reachable. */
export function createDemoSwarmBackendSnapshot(): SwarmBackendSnapshot {
  const tashi = demoTashi();
  return {
    node: { id: "preview-node", role: "gateway", status: "ok" },
    presence: { peers: 6 },
    missions: [{ id: "m-demo-1", status: "running", name: "Preview mission" }],
    history_tail: [],
    ts_ms: Date.now(),
    tashi,
  };
}

export function createDemoSwarmBackendHealth(): SwarmBackendHealth {
  const tashi = demoTashi();
  return {
    status: "ok",
    node: { id: "preview-node" },
    presence: {},
    mission_count: 2,
    mission_status_counts: { running: 1, idle: 1 },
    ts_ms: Date.now(),
    tashi,
  };
}
