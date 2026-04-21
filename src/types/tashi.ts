export interface TashiStateEnvelope {
  missionId: string;
  scenario: string;
  phase: string;
  mapSummary: {
    exploredCells: number;
    coveragePercent: number;
    targets: { id: string; confidence: number; status: string }[];
  };
  nodes: {
    nodeId: string;
    role: string;
    trust: number;
    battery: number;
    health: "online" | "syncing" | "degraded" | "stale";
    activeTasks: number;
  }[];
  alerts: {
    type: string;
    severity: "warning" | "critical";
    nodeId: string;
    message: string;
  }[];
  recovery: {
    state: "syncing" | "replaying" | "revalidating" | "recovered" | "degraded" | "stale" | "isolated";
    checkpointLag: number;
    mapLagPct: number;
  };
  settlement?: {
    ready: boolean;
    manifestHash: string;
  };
}
