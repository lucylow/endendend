import * as THREE from "three";

/**
 * Simulated FoxMQ-style handoff payload → approach vector + lift ring for Swarm B.
 */
export class SwarmHandoverEngine {
  private target = new THREE.Vector3(0, 0, 0);
  private approachDir = new THREE.Vector3(-1, 0, -0.35).normalize();

  initiateHandover(targetCoords: THREE.Vector3, _stakes: number[]) {
    this.target.copy(targetCoords);
    const from = new THREE.Vector3(35, 0, -25);
    this.approachDir.copy(this.target).sub(from);
    if (this.approachDir.lengthSq() < 1e-6) this.approachDir.set(-1, 0, 0);
    this.approachDir.normalize();
  }

  getHandoverVector(): THREE.Vector3 {
    return this.approachDir.clone();
  }

  getLiftPosition(_agentId: string, index: number, total: number): THREE.Vector3 {
    const angle = (index / Math.max(1, total)) * Math.PI * 2;
    const ring = 6;
    return new THREE.Vector3(
      this.target.x + Math.cos(angle) * ring,
      1.25,
      this.target.z + Math.sin(angle) * ring * 0.72,
    );
  }

  getTarget(): THREE.Vector3 {
    return this.target.clone();
  }
}
