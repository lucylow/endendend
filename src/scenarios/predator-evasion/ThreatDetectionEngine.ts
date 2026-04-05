import * as THREE from "three";

export class ThreatDetectionEngine {
  /** Returns true when the agent should treat the threat as inside the evasion envelope. */
  detectThreat(agentPos: THREE.Vector3, threatPos: THREE.Vector3, radius = 18): boolean {
    const distance = agentPos.distanceTo(threatPos);
    return distance < radius;
  }

  /** Simple closing-speed hint for HUD / future prediction. */
  threatClosingHint(agentPos: THREE.Vector3, threatPos: THREE.Vector3, threatVelZ: number): boolean {
    const dz = threatPos.z - agentPos.z;
    return dz > 0 && threatVelZ < 0;
  }
}
