import type { ResilienceSimAgent } from "./randomFailureStore";

export class FailureInjectionEngine {
  lastFailureTime = -1e9;

  injectRandomFailure(agents: ResilienceSimAgent[], currentTime: number, minAlive = 3): ResilienceSimAgent | null {
    const alive = agents.filter((a) => a.alive);
    if (alive.length <= minAlive) return null;
    if (currentTime - this.lastFailureTime < 30) return null;

    const victim = alive[Math.floor(Math.random() * alive.length)]!;
    victim.alive = false;
    victim.status = "failed";
    this.lastFailureTime = currentTime;
    return victim;
  }

  rebalanceRoles(agents: ResilienceSimAgent[]): ResilienceSimAgent[] {
    const next = agents.map((a) => ({ ...a, position: { ...a.position } }));
    const alive = next.filter((a) => a.alive).sort((a, b) => b.stake - a.stake);
    for (const a of next) {
      if (a.alive) a.role = "standby";
    }
    if (alive[0]) {
      const lead = next.find((x) => x.id === alive[0]!.id);
      if (lead) lead.role = "leader";
    }
    alive.slice(1, 4).forEach((ag) => {
      const r = next.find((x) => x.id === ag.id);
      if (r) r.role = "relay";
    });
    return next;
  }
}
