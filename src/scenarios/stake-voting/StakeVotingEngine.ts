import * as THREE from "three";
import type { VotingSimAgent } from "./stakeVotingStore";

export class StakeVotingEngine {
  readonly pathRisky = new THREE.Vector3(-30, 0, 30);
  readonly pathOptimal = new THREE.Vector3(30, 0, 30);

  getConsensusTarget(agents: Pick<VotingSimAgent, "stake" | "prefersOptimal">[]): THREE.Vector3 {
    let wA = 0;
    let wB = 0;
    for (const a of agents) {
      if (a.prefersOptimal) wB += a.stake;
      else wA += a.stake;
    }
    const total = wA + wB;
    if (total < 1e-6) return this.pathOptimal.clone();
    return wB >= wA ? this.pathOptimal.clone() : this.pathRisky.clone();
  }

  getVoteTally(agents: VotingSimAgent[]): { wA: number; wB: number; democraticOptimalPct: number } {
    let wA = 0;
    let wB = 0;
    let preferB = 0;
    for (const a of agents) {
      if (a.prefersOptimal) {
        wB += a.stake;
        preferB += 1;
      } else {
        wA += a.stake;
      }
    }
    const n = Math.max(1, agents.length);
    const democraticOptimalPct = (preferB / n) * 100;
    return { wA, wB, democraticOptimalPct };
  }

  getVotingPower(agent: VotingSimAgent): number {
    return agent.stake * 100;
  }
}
