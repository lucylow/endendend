import * as THREE from "three";
import type { Agent } from "@/types";

/** FoxMQ-style obstacle hints: per-agent repulsion samples merged for the field. */
export class ObstacleVectorModel {
  private vectors = new Map<string, THREE.Vector3>();

  shareVector(agentId: string, vector: THREE.Vector3) {
    this.vectors.set(agentId, vector.clone());
  }

  getRepulsion(pos: THREE.Vector3, obstacle: THREE.Vector3): THREE.Vector3 {
    const d = pos.distanceTo(obstacle);
    if (d < 1e-4) return new THREE.Vector3(1, 0, 0);
    return new THREE.Vector3()
      .subVectors(pos, obstacle)
      .normalize()
      .multiplyScalar(5 / d);
  }

  getAverageRepulsion(agents: Agent[], obstacle: THREE.Vector3): THREE.Vector3 {
    if (agents.length === 0) return new THREE.Vector3(0, 0, 0);
    const avg = new THREE.Vector3();
    for (const agent of agents) {
      const p = new THREE.Vector3(agent.position.x, agent.position.y, agent.position.z);
      avg.add(this.getRepulsion(p, obstacle));
    }
    return avg.divideScalar(agents.length).normalize();
  }

  snapshotCount() {
    return this.vectors.size;
  }
}
