import * as THREE from "three";
import type { ThermalSimAgent } from "./thermalRebalanceStore";

function stakeWeight(stakeAmount: number): number {
  return Math.max(0.15, Math.min(1, stakeAmount / 600));
}

export class ThermalVotingEngine {
  getSeparationVector(agent: ThermalSimAgent, agents: ThermalSimAgent[]): THREE.Vector3 {
    const hot = agents.filter((a) => a.temperature > 70);
    if (hot.length === 0) return new THREE.Vector3(0, 0, 0);
    const centroid = new THREE.Vector3();
    hot.forEach((a) => centroid.add(new THREE.Vector3(a.position.x, 0, a.position.z)));
    centroid.multiplyScalar(1 / hot.length);
    const p = new THREE.Vector3(agent.position.x, 0, agent.position.z);
    const away = p.clone().sub(centroid);
    if (away.lengthSq() < 1e-8) {
      away.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
    }
    return away.normalize();
  }

  calculateShielding(agents: ThermalSimAgent[], heatSource: THREE.Vector3): THREE.Vector3 {
    const cool = agents.filter((a) => a.temperature < 52 && a.status === "active");
    if (cool.length === 0) return new THREE.Vector3(0, 0, 1);
    const acc = new THREE.Vector3();
    for (const a of cool) {
      const ap = new THREE.Vector3(a.position.x, 0, a.position.z);
      const dir = ap.clone().sub(heatSource);
      if (dir.lengthSq() < 1e-8) continue;
      dir.normalize();
      acc.add(dir.multiplyScalar(stakeWeight(a.stakeAmount)));
    }
    if (acc.lengthSq() < 1e-8) return new THREE.Vector3(0, 0, 1);
    return acc.normalize();
  }
}
