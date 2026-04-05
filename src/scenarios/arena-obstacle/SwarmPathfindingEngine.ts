import * as THREE from "three";
import type { WarehouseObstacle } from "./DynamicObstacleCourse";

export type ArenaAgentLike = {
  position: { x: number; z: number };
  velocity: { x: number; z: number };
  id: string;
};

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

export class SwarmPathfindingEngine {
  getOptimalPath(
    agent: ArenaAgentLike,
    allAgents: ArenaAgentLike[],
    target: THREE.Vector3,
    obstacles: WarehouseObstacle[],
  ): THREE.Vector3 {
    const agentPos = _v1.set(agent.position.x, 0, agent.position.z);

    const directPath = _v2.subVectors(target, agentPos);
    if (directPath.lengthSq() < 1e-6) return new THREE.Vector3(0, 0, 1);
    directPath.normalize();

    const obs = this.obstacleRepulsion(agentPos, obstacles).multiplyScalar(0.28);
    const flock = this.flockingForce(agent, allAgents).multiplyScalar(0.14);
    const lane = this.laneOptimization(agent, allAgents).multiplyScalar(0.06);

    return new THREE.Vector3()
      .copy(directPath)
      .multiplyScalar(0.52)
      .add(obs)
      .add(flock)
      .add(lane)
      .normalize();
  }

  private obstacleRepulsion(pos: THREE.Vector3, obstacles: WarehouseObstacle[]): THREE.Vector3 {
    const acc = _v3.set(0, 0, 0);
    for (const o of obstacles) {
      const cx = o.x;
      const cz = o.z;
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const dist = Math.hypot(dx, dz) + 0.01;
      const clearance = Math.max(o.halfW, o.halfD) + 2.2;
      if (dist < clearance) {
        const push = (clearance - dist) / clearance;
        acc.x += (dx / dist) * push * 1.4;
        acc.z += (dz / dist) * push * 1.4;
      }
    }
    if (acc.lengthSq() < 1e-8) return new THREE.Vector3(0, 0, 0);
    return acc.normalize();
  }

  private flockingForce(agent: ArenaAgentLike, all: ArenaAgentLike[]): THREE.Vector3 {
    const sep = new THREE.Vector3(0, 0, 0);
    let n = 0;
    for (const other of all) {
      if (other.id === agent.id) continue;
      const dx = agent.position.x - other.position.x;
      const dz = agent.position.z - other.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0 && d < 4) {
        const w = (4 - d) / 4;
        sep.x += (dx / d) * w;
        sep.z += (dz / d) * w;
        n++;
      }
    }
    if (n === 0) return new THREE.Vector3(0, 0, 0);
    sep.multiplyScalar(1 / n);
    if (sep.lengthSq() < 1e-8) return new THREE.Vector3(0, 0, 0);
    return sep.normalize();
  }

  private laneOptimization(agent: ArenaAgentLike, all: ArenaAgentLike[]): THREE.Vector3 {
    let ahead = 0;
    const side = new THREE.Vector3(0, 0, 0);
    for (const other of all) {
      if (other.id === agent.id) continue;
      if (other.position.x > agent.position.x - 1) ahead++;
      const dz = agent.position.z - other.position.z;
      if (Math.abs(dz) < 3 && other.position.x > agent.position.x - 5) {
        side.x += dz * 0.08;
        side.z += -Math.sign(dz || 1) * 0.12;
      }
    }
    if (ahead < 2) return new THREE.Vector3(0, 0, 0);
    if (side.lengthSq() < 1e-8) return new THREE.Vector3(0, 0, 0);
    return side.normalize();
  }
}
