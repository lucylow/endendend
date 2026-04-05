import * as THREE from "three";

export type EvasionPhase = "idle" | "scatter" | "reform";

export interface EvasionSimAgent {
  id: string;
  position: { x: number; y: number; z: number };
  evasionPhase: EvasionPhase;
}

export class EvasionManeuverEngine {
  getEvasionVector(
    agent: EvasionSimAgent,
    _allAgents: EvasionSimAgent[],
    threatPos: THREE.Vector3,
  ): THREE.Vector3 {
    const agentPos = new THREE.Vector3(agent.position.x, 0, agent.position.z);

    if (agent.evasionPhase === "scatter") {
      const threatDirection = new THREE.Vector3().subVectors(threatPos, agentPos);
      if (threatDirection.lengthSq() < 1e-6) return new THREE.Vector3(1.5, 0, 0);
      threatDirection.normalize();

      const scatterDirection = new THREE.Vector3(-threatDirection.z, 0, threatDirection.x);
      return scatterDirection.multiplyScalar(1.5);
    }

    if (agent.evasionPhase === "reform") {
      const safeZone = new THREE.Vector3(threatPos.x - 15, 0, threatPos.z - 25);
      const toSafe = new THREE.Vector3().subVectors(safeZone, agentPos);
      if (toSafe.lengthSq() < 1e-6) return new THREE.Vector3();
      return toSafe.normalize().multiplyScalar(1.2);
    }

    return new THREE.Vector3();
  }
}
