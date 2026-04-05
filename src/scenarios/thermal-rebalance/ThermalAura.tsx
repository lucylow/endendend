import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ThermalSimAgent } from "./thermalRebalanceStore";
import { thermalColor } from "./thermalRebalanceStore";

export default function ThermalAura({ agent }: { agent: ThermalSimAgent }) {
  const mesh = useRef<THREE.Mesh>(null);
  const color = useMemo(() => new THREE.Color(thermalColor(agent.temperature)), [agent.temperature]);

  useFrame(() => {
    if (!mesh.current) return;
    const s = 2.2 + (agent.temperature - 25) * 0.028;
    mesh.current.scale.setScalar(s);
    mesh.current.position.set(agent.position.x, 1.45, agent.position.z);
    color.set(thermalColor(agent.temperature));
    const m = mesh.current.material as THREE.MeshBasicMaterial;
    m.color.copy(color);
    m.opacity = 0.06 + Math.min(0.16, (agent.temperature - 25) / 220);
  });

  return (
    <mesh ref={mesh} position={[agent.position.x, 1.45, agent.position.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.4, 2.1, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
