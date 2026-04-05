import type { Agent, SwarmData } from "@/types";

/** Raw vec3 from Webots / FoxMQ bridge */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface AgentTelemetry {
  id: string;
  position: Vec3;
  velocity?: Vec3;
  role: Agent["role"];
  battery: number;
  status: Agent["status"];
  depth?: number;
  /** Server wall time in ms when sample was taken (optional) */
  serverTimeMs?: number;
  taskId?: string | null;
}

export interface TelemetrySwarmUpdate {
  type: "telemetry";
  timestamp: number;
  swarmId?: string;
  agents: AgentTelemetry[];
}

export interface SwarmStatusUpdate {
  type: "swarm_status";
  timestamp?: number;
  swarmId?: string;
  name?: string;
  agentCount?: number;
  status?: SwarmData["status"];
}

/** Edge-local critical path latency (e.g. SAFETY_STOP), emitted by the Python/Webots bridge when wired. */
export interface EdgeLatencyUpdate {
  type: "edge_latency";
  operation: string;
  latencyMs: number;
  sender?: string;
  receiver?: string;
  timestamp?: number;
}

export type SwarmUpdate = TelemetrySwarmUpdate | SwarmStatusUpdate | EdgeLatencyUpdate;

export type WsConnectionState = "connecting" | "connected" | "disconnected";
