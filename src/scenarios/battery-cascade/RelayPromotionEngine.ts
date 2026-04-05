import type { Agent } from "@/types";

export class RelayPromotionEngine {
  /** `missionPhase` is 0–1 sim progress (e.g. elapsed / 90s) so promotion deepens as the run advances. */
  shouldPromoteToRelay(candidate: Agent, allAgents: Agent[], missionPhase: number): boolean {
    if (candidate.role === "relay" || candidate.status !== "active") return false;
    if (candidate.role !== "standby") return false;

    const relaysAhead = allAgents.filter(
      (a) => a.role === "relay" && a.status === "active" && a.position.z < candidate.position.z - 18,
    );

    const relays = allAgents.filter((a) => a.role === "relay" && a.status === "active");
    const avgRelayBattery =
      relays.length === 0 ? 40 : relays.reduce((sum, a) => sum + a.battery, 0) / relays.length;

    return (
      relaysAhead.length === 0 &&
      candidate.battery > avgRelayBattery + 8 &&
      missionPhase > 0.38
    );
  }
}
