import type { Agent, Position } from "@/types";
import type { AgentTelemetry } from "@/types/websocket";

const ROLE_COLORS: Record<Agent["role"], string> = {
  explorer: "#00d4ff",
  relay: "#6366f1",
  standby: "#525252",
};

function interpolatePosition(from: Position, to: Position, alpha: number): Position {
  return {
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
    z: from.z + (to.z - from.z) * alpha,
  };
}

function defaultAgentFromTelemetry(tel: AgentTelemetry): Agent {
  return {
    id: tel.id,
    name: `Agent-${tel.id.slice(-6)}`,
    role: tel.role,
    position: { ...tel.position },
    battery: tel.battery,
    status: tel.status,
    trajectory: [],
    color: ROLE_COLORS[tel.role],
    latency: 0,
    tasksCompleted: 0,
    stakeAmount: 100,
    currentBehavior: tel.role === "explorer" ? "exploring" : tel.role === "relay" ? "relaying" : "idle",
    assignedCell: null,
    targetId: null,
    isByzantine: false,
    lastTelemetryServerMs: tel.serverTimeMs,
  };
}

/**
 * Smoothing + merge with existing store agents (dead reckoning: agents not in a frame are kept).
 */
export class RealtimeSyncEngine {
  private latencies: number[] = [];
  private messageTimestamps: number[] = [];
  private readonly smoothing = 0.35;

  processTelemetry(telemetry: AgentTelemetry[], existing: Agent[]): Agent[] {
    const now = Date.now();
    const incomingIds = new Set(telemetry.map((t) => t.id));
    const map = new Map<string, Agent>();

    for (const a of existing) {
      if (!incomingIds.has(a.id)) map.set(a.id, { ...a });
    }

    for (const tel of telemetry) {
      const prev = map.get(tel.id);
      const serverMs = tel.serverTimeMs ?? now;
      const latency = Math.max(0, now - serverMs);
      this.latencies.push(latency);
      if (this.latencies.length > 100) this.latencies.shift();

      this.messageTimestamps.push(now);
      const cutoff = now - 1000;
      while (this.messageTimestamps.length && this.messageTimestamps[0]! < cutoff) {
        this.messageTimestamps.shift();
      }

      const targetPos = { ...tel.position };

      if (prev) {
        const smoothed = interpolatePosition(prev.position, targetPos, this.smoothing);
        const traj =
          prev.trajectory.length >= 200
            ? [...prev.trajectory.slice(-199), smoothed]
            : [...prev.trajectory, smoothed];

        map.set(tel.id, {
          ...prev,
          position: smoothed,
          battery: tel.battery,
          role: tel.role,
          status: tel.status,
          color: ROLE_COLORS[tel.role],
          trajectory: traj,
          lastTelemetryServerMs: serverMs,
          latency,
        });
      } else {
        map.set(tel.id, defaultAgentFromTelemetry(tel));
      }
    }

    return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  get averageLatencyMs(): number {
    if (this.latencies.length === 0) return 0;
    return this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }

  get messagesPerSecond(): number {
    return this.messageTimestamps.length;
  }
}
