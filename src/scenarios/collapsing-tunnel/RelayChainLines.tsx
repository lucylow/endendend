import { useMemo } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { TunnelSimAgent } from "./collapsingTunnelStore";

export default function RelayChainLines({ agents }: { agents: TunnelSimAgent[] }) {
  const segments = useMemo(() => {
    const relays = [...agents]
      .filter((a) => a.tunnelRescueRole === "relay" && !a.trapped && a.status === "active")
      .sort((a, b) => a.position.z - b.position.z);
    const out: THREE.Vector3[][] = [];
    for (let i = 0; i < relays.length - 1; i++) {
      const a = relays[i]!;
      const b = relays[i + 1]!;
      out.push([
        new THREE.Vector3(a.position.x, a.position.y + 0.4, a.position.z),
        new THREE.Vector3(b.position.x, b.position.y + 0.4, b.position.z),
      ]);
    }
    return out;
  }, [agents]);

  return (
    <group>
      {segments.map((pts, i) => (
        <Line key={i} points={pts} color="#38bdf8" lineWidth={1.5} />
      ))}
    </group>
  );
}
