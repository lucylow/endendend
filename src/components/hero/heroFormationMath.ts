import type { Agent } from "@/types";
import * as THREE from "three";

const ROLE_COLOR: Record<Agent["role"], string> = {
  explorer: "#22d3ee",
  relay: "#818cf8",
  standby: "#64748b",
};

/** Stable pseudo-random in [0, 1) from index. */
function hash01(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function roleColor(role: Agent["role"]): string {
  return ROLE_COLOR[role];
}

/**
 * Shared world pose for hero swarm: V-formation + gentle orbit so 3D layers stay aligned.
 */
export function heroWorldPose(agent: Agent, index: number, total: number, t: number) {
  const n = Math.max(1, total);
  const u = index / n;
  const spread = 16;
  const arm = (u - 0.5) * 2 * spread;
  const stagger = Math.sin(u * Math.PI * 2 + t * 0.35) * 1.8;
  const depth = u * 28 - 8 + Math.cos(t * 0.22 + index * 0.09) * 2.5;

  const wing = index % 2 === 0 ? 1 : -1;
  const x = arm * 0.55 + wing * Math.abs(arm) * 0.35 + stagger + Math.sin(t * 0.4 + index * 0.11) * 3;
  const baseY = agent.role === "explorer" ? 3.2 : agent.role === "relay" ? 2 : 1.2;
  const y =
    baseY +
    Math.sin(t * 0.55 + index * 0.17) * 1.1 +
    (agent.position.y * 0.08 + (hash01(index, 1) - 0.5) * 0.6);
  const z = depth + agent.position.z * 0.12;

  const rotY = t * 0.45 + index * 0.12 + (agent.role === "relay" ? 0.4 : 0);
  const bat = Math.max(5, Math.min(100, agent.battery));
  const scale = 0.55 + (bat / 100) * 0.95;

  return { x, y, z, rotY, scale };
}

export function heroWorldVector(agent: Agent, index: number, total: number, t: number, target: THREE.Vector3) {
  const p = heroWorldPose(agent, index, total, t);
  return target.set(p.x, p.y, p.z);
}
