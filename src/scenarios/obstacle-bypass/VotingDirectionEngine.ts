import * as THREE from "three";
import type { Agent } from "@/types";

export class VotingDirectionEngine {
  /** Stake-weighted consensus around obstacle — bias CCW circulation. */
  getConsensusDirection(agents: Agent[], obstacle: THREE.Vector3): THREE.Vector3 {
    if (agents.length === 0) return new THREE.Vector3(0, 0, 1);
    const consensus = new THREE.Vector3(0, 0, 0);

    for (const agent of agents) {
      const agentPos = new THREE.Vector3(agent.position.x, 0, agent.position.z);
      const toObstacle = new THREE.Vector3().subVectors(obstacle, agentPos);
      if (toObstacle.lengthSq() < 1e-6) continue;
      const perpendicularCCW = new THREE.Vector3(toObstacle.z, 0, -toObstacle.x).normalize();
      const w = Math.max(1, agent.stakeAmount / 100);
      consensus.add(perpendicularCCW.multiplyScalar(w));
    }

    if (consensus.lengthSq() < 1e-8) return new THREE.Vector3(0, 0, 1);
    return consensus.normalize();
  }
}
