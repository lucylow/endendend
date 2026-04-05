import { useMemo } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { Agent } from "@/types";

export interface ConnectionNetworkProps {
  agents: Agent[];
  visible?: boolean;
  mode?: "relay-chain" | "proximity";
}

function relayChainSegments(agents: Agent[]): [THREE.Vector3, THREE.Vector3][] {
  const chain = [...agents].filter((a) => a.role === "relay" || a.role === "explorer");
  if (chain.length < 2) return [];
  chain.sort((a, b) => b.position.z - a.position.z);
  const out: [THREE.Vector3, THREE.Vector3][] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    out.push([
      new THREE.Vector3(a.position.x, a.position.y, a.position.z),
      new THREE.Vector3(b.position.x, b.position.y, b.position.z),
    ]);
  }
  return out;
}

function proximitySegments(agents: Agent[], maxDist: number): [THREE.Vector3, THREE.Vector3][] {
  const out: [THREE.Vector3, THREE.Vector3][] = [];
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i].position;
      const b = agents[j].position;
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (d < maxDist) {
        out.push([
          new THREE.Vector3(a.x, a.y, a.z),
          new THREE.Vector3(b.x, b.y, b.z),
        ]);
      }
    }
  }
  return out;
}

export default function ConnectionNetwork({
  agents,
  visible = true,
  mode = "relay-chain",
}: ConnectionNetworkProps) {
  const segments = useMemo(() => {
    if (!visible) return [];
    return mode === "relay-chain" ? relayChainSegments(agents) : proximitySegments(agents, 8);
  }, [agents, visible, mode]);

  if (!visible || segments.length === 0) return null;

  return (
    <group>
      {segments.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color={mode === "relay-chain" ? "#38bdf8" : "#22d3ee"}
          lineWidth={mode === "relay-chain" ? 2 : 1}
          transparent
          opacity={mode === "relay-chain" ? 0.55 : 0.12}
        />
      ))}
    </group>
  );
}
