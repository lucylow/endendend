import type {
  AgentTelemetry,
  EdgeLatencyUpdate,
  SwarmStatusUpdate,
  SwarmUpdate,
  TelemetrySwarmUpdate,
  Vec3,
} from "@/types/websocket";
import type { Agent } from "@/types";

function asVec3(v: unknown): Vec3 | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const x = Number(o.x);
  const y = Number(o.y);
  const z = Number(o.z);
  if (![x, y, z].every((n) => Number.isFinite(n))) return null;
  return { x, y, z };
}

function normalizeRole(raw: unknown): Agent["role"] {
  const s = String(raw ?? "").toLowerCase();
  if (s === "explorer" || s === "relay" || s === "standby") return s;
  if (s === "leader" || s === "scout") return "explorer";
  if (s === "router" || s === "node") return "relay";
  return "standby";
}

function normalizeStatus(raw: unknown): Agent["status"] {
  const s = String(raw ?? "").toLowerCase();
  if (s === "active" || s === "low-battery" || s === "offline") return s;
  if (s === "ok" || s === "running" || s === "online") return "active";
  if (s === "low" || s === "critical") return "low-battery";
  if (s === "down" || s === "dead") return "offline";
  return "active";
}

function normalizeSwarmStatus(raw: unknown): SwarmStatusUpdate["status"] | undefined {
  const s = String(raw ?? "").toLowerCase();
  if (s === "idle" || s === "exploring" || s === "coordinating" || s === "emergency") return s;
  return undefined;
}

function parseTimestampSeconds(ts: unknown): number {
  const n = Number(ts);
  if (!Number.isFinite(n)) return Date.now() / 1000;
  return n;
}

function parseAgent(raw: unknown, frameTimestampSec: number): AgentTelemetry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = o.id != null ? String(o.id) : "";
  if (!id) return null;
  const pos = asVec3(o.position);
  if (!pos) return null;
  const role = normalizeRole(o.role);
  const battery = Number(o.battery);
  const status = normalizeStatus(o.status);
  const depth = o.depth != null ? Number(o.depth) : undefined;
  const serverTimeMs =
    typeof o.serverTimeMs === "number" && Number.isFinite(o.serverTimeMs)
      ? o.serverTimeMs
      : frameTimestampSec * 1000;

  return {
    id,
    position: pos,
    velocity: asVec3(o.velocity) ?? undefined,
    role,
    battery: Number.isFinite(battery) ? battery : 100,
    status,
    depth: depth !== undefined && Number.isFinite(depth) ? depth : undefined,
    serverTimeMs,
    taskId: o.taskId != null ? String(o.taskId) : null,
  };
}

/**
 * Parse Webots / FoxMQ JSON into a typed {@link SwarmUpdate}.
 * Returns null if the payload is not recognized or invalid JSON.
 */
export function decodeWebotsStreamMessage(raw: string): SwarmUpdate | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const t = o.type;

  if (t === "agent_telemetry") {
    const frameTs = parseTimestampSeconds(o.timestamp);
    const agentsRaw = o.agents;
    if (!Array.isArray(agentsRaw)) return null;
    const agents: AgentTelemetry[] = [];
    for (const a of agentsRaw) {
      const tel = parseAgent(a, frameTs);
      if (tel) agents.push(tel);
    }
    const out: TelemetrySwarmUpdate = {
      type: "telemetry",
      timestamp: frameTs,
      swarmId: o.swarm_id != null ? String(o.swarm_id) : undefined,
      agents,
    };
    return out;
  }

  if (t === "swarm_status") {
    const status = o.status != null ? normalizeSwarmStatus(o.status) : undefined;
    const out: SwarmStatusUpdate = {
      type: "swarm_status",
      timestamp: typeof o.timestamp === "number" ? o.timestamp : undefined,
      swarmId: o.swarm_id != null ? String(o.swarm_id) : undefined,
      name: o.name != null ? String(o.name) : undefined,
      agentCount: typeof o.agentCount === "number" ? o.agentCount : undefined,
      status,
    };
    return out;
  }

  if (t === "edge_latency") {
    const latencyMs = Number(o.latencyMs);
    if (!Number.isFinite(latencyMs)) return null;
    const out: EdgeLatencyUpdate = {
      type: "edge_latency",
      operation: o.operation != null ? String(o.operation) : "unknown",
      latencyMs,
      sender: o.sender != null ? String(o.sender) : undefined,
      receiver: o.receiver != null ? String(o.receiver) : undefined,
      timestamp: typeof o.timestamp === "number" ? o.timestamp : undefined,
    };
    return out;
  }

  return null;
}
