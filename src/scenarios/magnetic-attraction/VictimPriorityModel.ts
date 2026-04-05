import * as THREE from "three";
import type { MagneticAttractionState, MagneticSimAgent } from "./magneticAttractionStore";

export class VictimPriorityModel {
  getNetAttraction(
    agent: MagneticSimAgent,
    agents: MagneticSimAgent[],
    victims: MagneticAttractionState["victims"],
  ): THREE.Vector3 {
    const p = new THREE.Vector3(agent.position.x, 0, agent.position.z);
    const acc = new THREE.Vector3();
    const stakeN = Math.max(0.12, agent.stakeAmount / 550);

    for (const v of victims) {
      const vp = new THREE.Vector3(v.x, 0, v.z);
      const d = p.distanceTo(vp);
      const strength = (stakeN * v.value) / (d * d + 1.5);
      const pull = vp.clone().sub(p);
      if (pull.lengthSq() < 1e-10) continue;
      pull.normalize().multiplyScalar(strength);
      acc.add(pull);
    }

    const centroid = new THREE.Vector3();
    agents.forEach((a) => centroid.add(new THREE.Vector3(a.position.x, 0, a.position.z)));
    centroid.multiplyScalar(1 / Math.max(1, agents.length));
    const best = victims.reduce((a, b) => (a.value >= b.value ? a : b));
    const optimal = new THREE.Vector3(best.x, 0, best.z);
    const swarmBias = optimal.clone().sub(centroid).normalize().multiplyScalar(0.08 * stakeN);
    acc.add(swarmBias);

    if (acc.lengthSq() < 1e-10) return new THREE.Vector3(0, 0, 0);
    return acc;
  }
}
