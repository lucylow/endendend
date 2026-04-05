import * as THREE from "three";

export type ShelfObstacle = { x: number; z: number };

export type AgentPoint = { id: string; x: number; z: number };

export class ContinuousPathEngine {
  assignRestockRole(agentId: string, agents: { id: string; restockCount: number }[]): "picker" | "runner" | "buffer" {
    if (agents.length === 0) return "picker";
    const sorted = [...agents].sort((a, b) => a.restockCount - b.restockCount);
    const rank = sorted.findIndex((a) => a.id === agentId);
    if (rank <= 2) return "runner";
    if (rank >= agents.length - 2) return "buffer";
    return "picker";
  }

  getShelfRepulsion(pos: THREE.Vector3, shelves: ShelfObstacle[], out: THREE.Vector3): THREE.Vector3 {
    out.set(0, 0, 0);
    for (const s of shelves) {
      const dx = pos.x - s.x;
      const dz = pos.z - s.z;
      const d2 = dx * dx + dz * dz + 6;
      const d = Math.sqrt(d2);
      const w = 140 / d2;
      out.x += (dx / d) * w;
      out.z += (dz / d) * w;
    }
    if (out.lengthSq() < 1e-8) out.set(0, 0, 0);
    else out.normalize();
    return out;
  }

  getTrafficFlow(pos: THREE.Vector3, selfId: string, agents: AgentPoint[], out: THREE.Vector3): THREE.Vector3 {
    out.set(0, 0, 0);
    for (const a of agents) {
      if (a.id === selfId) continue;
      const dx = pos.x - a.x;
      const dz = pos.z - a.z;
      const d2 = dx * dx + dz * dz + 3;
      if (d2 > 100) continue;
      const d = Math.sqrt(d2);
      const f = (10 - d) / 10;
      if (f <= 0) continue;
      out.x += (dx / d) * f;
      out.z += (dz / d) * f;
    }
    if (out.lengthSq() < 1e-8) out.set(0, 0, 0);
    else out.normalize();
    return out;
  }

  getDynamicPath(
    agentPos: THREE.Vector3,
    target: THREE.Vector3,
    shelves: ShelfObstacle[],
    selfId: string,
    agents: AgentPoint[],
    directOut: THREE.Vector3,
    scratchA: THREE.Vector3,
    scratchB: THREE.Vector3,
    scratchC: THREE.Vector3,
  ): THREE.Vector3 {
    directOut.subVectors(target, agentPos);
    if (directOut.lengthSq() < 1e-6) return directOut.set(0, 0, 0);
    directOut.normalize();

    this.getShelfRepulsion(agentPos, shelves, scratchA);
    this.getTrafficFlow(agentPos, selfId, agents, scratchB);

    scratchC
      .copy(directOut)
      .multiplyScalar(0.62)
      .add(scratchA.multiplyScalar(0.28))
      .add(scratchB.multiplyScalar(0.1));

    if (scratchC.lengthSq() < 1e-8) return directOut;
    return scratchC.normalize();
  }
}
