import * as THREE from "three";
import type { MagneticSimAgent } from "./magneticAttractionStore";

export class AttractionFieldEngine {
  getConsensusAttraction(
    agent: MagneticSimAgent,
    allAgents: MagneticSimAgent[],
    netPull: THREE.Vector3,
  ): THREE.Vector3 {
    const consensus = new THREE.Vector3();
    let wsum = 0;
    const selfW = Math.max(0.2, agent.stakeAmount / 400);
    consensus.add(netPull.clone().multiplyScalar(selfW));
    wsum += selfW;

    for (const peer of allAgents) {
      if (peer.id === agent.id) continue;
      const dx = agent.position.x - peer.position.x;
      const dz = agent.position.z - peer.position.z;
      const d = Math.sqrt(dx * dx + dz * dz) + 0.8;
      const w = (peer.stakeAmount / 500) / d;
      consensus.add(netPull.clone().multiplyScalar(w * 0.55));
      wsum += w * 0.55;
    }

    if (wsum < 1e-8) return netPull.lengthSq() > 1e-10 ? netPull.normalize() : new THREE.Vector3(0, 0, 0);
    consensus.multiplyScalar(1 / wsum);
    return consensus.lengthSq() > 1e-10 ? consensus.normalize() : netPull.normalize();
  }
}
