import * as THREE from "three";
import type { TunnelRescueRole, TunnelSimAgent } from "./collapsingTunnelStore";

const EXIT = new THREE.Vector3(0, 0, 32);
const COLLAPSE = new THREE.Vector3(0, 0, -42);

export class RescueChainReformation {
  private calculateRelayGap(agents: TunnelSimAgent[]): number {
    const relays = agents.filter((a) => !a.trapped && a.status === "active").sort((a, b) => a.position.z - b.position.z);
    if (relays.length < 2) return 0;
    let max = 0;
    for (let i = 1; i < relays.length; i++) {
      const dz = Math.abs(relays[i]!.position.z - relays[i - 1]!.position.z);
      const dx = Math.abs(relays[i]!.position.x - relays[i - 1]!.position.x);
      max = Math.max(max, Math.hypot(dx, dz));
    }
    return max;
  }

  assignRescueRole(agent: TunnelSimAgent, allAgents: TunnelSimAgent[]): TunnelRescueRole {
    if (agent.trapped || agent.status !== "active") return "support";

    const trappedCount = allAgents.filter((a) => a.trapped).length;
    const relayGap = this.calculateRelayGap(allAgents);
    const stakeN = agent.stakeAmount / 800;

    if (relayGap > 12 && agent.battery > 30) return "relay";

    if (trappedCount > 0 && stakeN > 0.4) return "rescue_lead";

    return "support";
  }

  getRescuePath(agent: TunnelSimAgent): THREE.Vector3 {
    const p = new THREE.Vector3(agent.position.x, 0, agent.position.z);
    const toExit = EXIT.clone().sub(p);
    const toCollapse = COLLAPSE.clone().sub(p);
    if (toExit.lengthSq() < 1e-8) return new THREE.Vector3(0, 0, 1);
    if (toCollapse.lengthSq() < 1e-8) return toExit.normalize();
    toExit.normalize();
    toCollapse.normalize();
    return toExit.multiplyScalar(0.6).add(toCollapse.multiplyScalar(0.4)).normalize();
  }

  /** Unit direction toward exit, biased to stay centered in tunnel (x → 0). */
  relayHeading(agent: TunnelSimAgent): THREE.Vector3 {
    const p = new THREE.Vector3(agent.position.x, 0, agent.position.z);
    const toExit = EXIT.clone().sub(p);
    toExit.x += -p.x * 0.35;
    if (toExit.lengthSq() < 1e-8) return new THREE.Vector3(0, 0, 1);
    return toExit.normalize();
  }

  /** Spacing force vs other active forward agents to avoid stacking. */
  separation(agent: TunnelSimAgent, peers: TunnelSimAgent[]): THREE.Vector3 {
    const p = new THREE.Vector3(agent.position.x, 0, agent.position.z);
    const acc = new THREE.Vector3();
    for (const o of peers) {
      if (o.id === agent.id || o.trapped) continue;
      const op = new THREE.Vector3(o.position.x, 0, o.position.z);
      const d = p.clone().sub(op);
      const len = d.length();
      if (len < 0.01 || len > 6) continue;
      acc.add(d.normalize().multiplyScalar(1 / (len + 0.5)));
    }
    if (acc.lengthSq() < 1e-8) return new THREE.Vector3(0, 0, 0);
    return acc.normalize();
  }
}
