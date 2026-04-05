/**
 * Simulated mesh heartbeat: if no RX for {@link windowSec} sim seconds, treat as failed link.
 * 50ms wall-clock equivalent in accelerated sim uses ~0.05s sim window at 1× scale.
 */
export class HeartbeatConsensus {
  private lastRx = new Map<string, number>();
  private skipRxUntil = new Map<string, number>();

  /** Inject a short RX blackout for demo (sim time). */
  blackout(id: string, untilSimTime: number) {
    this.skipRxUntil.set(id, untilSimTime);
  }

  receive(id: string, simTime: number) {
    const until = this.skipRxUntil.get(id) ?? 0;
    if (simTime < until) return;
    this.lastRx.set(id, simTime);
  }

  isAlive(id: string, simTime: number, windowSec = 0.05): boolean {
    const last = this.lastRx.get(id);
    if (last == null) {
      this.lastRx.set(id, simTime);
      return true;
    }
    return simTime - last <= windowSec;
  }
}
