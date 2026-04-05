import type { TunnelSimAgent } from "./collapsingTunnelStore";

/** Mission-style heartbeat window (operator HUD). */
export const HEARTBEAT_TOLERANCE_MS = 100;

/** Legacy constant for timeline copy (seconds). */
export const HEARTBEAT_LOSS_THRESHOLD_S = HEARTBEAT_TOLERANCE_MS / 1000;

/**
 * Survivors receive a synthetic beat every frame; buried agents stop updating → instant loss.
 */
export class HeartbeatLossDetection {
  private heartbeats = new Map<string, number>();

  isAlive(agent: TunnelSimAgent, nowMs: number = performance.now()): boolean {
    if (agent.trapped || agent.heartbeatLost) return false;

    const last = this.heartbeats.get(agent.id);
    if (last === undefined) {
      this.heartbeats.set(agent.id, nowMs);
      return true;
    }
    if (nowMs - last > HEARTBEAT_TOLERANCE_MS) return false;

    this.heartbeats.set(agent.id, nowMs);
    return true;
  }

  reset(): void {
    this.heartbeats.clear();
  }
}
