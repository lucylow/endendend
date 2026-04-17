/**
 * Types aligned with ``swarm.backend_service`` HTTP/JSON (snapshot, health, command).
 * The ``tashi`` block is a read-only projection for Vertex / FoxMQ dashboards.
 */

export type SwarmBackendMeshProjection = {
  nodeId?: string;
  swarmId?: string;
  version?: number;
  updatedAtMs?: number;
  role?: string;
  status?: string;
  depth?: number;
  peerCount?: number;
  taskCount?: number;
  alertCount?: number;
};

export type SwarmTashiProjection = {
  mesh: SwarmBackendMeshProjection;
  registers: { keys: string[]; worldMap: unknown };
  chainHint: {
    monotonicMeshVersion?: number;
    meshClockMs?: number;
    storeMetrics: Record<string, unknown>;
  };
  missionsBrief: Array<{ mission_id: string; name: string; status: string }>;
  historyTail: Array<Record<string, unknown>>;
};

export type SwarmBackendSnapshot = {
  node: Record<string, unknown>;
  presence: Record<string, unknown>;
  missions: Array<Record<string, unknown>>;
  history_tail: Array<Record<string, unknown>>;
  ts_ms: number;
  tashi?: SwarmTashiProjection;
};

export type SwarmBackendHealth = {
  status: string;
  node: Record<string, unknown>;
  presence: Record<string, unknown>;
  mission_count: number;
  mission_status_counts: Record<string, number>;
  ts_ms: number;
  tashi?: SwarmTashiProjection;
};

export type SwarmCommandResponseBody = {
  ok: boolean;
  result: Record<string, unknown>;
  error: string | null;
  async: boolean;
  response: Record<string, unknown> | null;
};
