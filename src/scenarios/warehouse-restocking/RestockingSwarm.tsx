import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { useWarehouseRestockStore } from "@/store/warehouseRestockStore";

const roleColor: Record<string, string> = {
  picker: "#f59e0b",
  runner: "#38bdf8",
  buffer: "#a78bfa",
};

function VelocityWhiskers() {
  const pickers = useWarehouseRestockStore((s) => s.pickers);
  return (
    <group>
      {pickers.map((p) => {
        const points = [
          new THREE.Vector3(p.x, 1.15, p.z),
          new THREE.Vector3(p.x + p.vx * 0.22, 1.15, p.z + p.vz * 0.22),
        ];
        return (
          <Line
            key={p.id}
            points={points}
            color="#94a3b8"
            lineWidth={1}
            transparent
            opacity={0.35}
          />
        );
      })}
    </group>
  );
}

export default function RestockingSwarm() {
  const advance = useWarehouseRestockStore((s) => s.advance);
  const pickers = useWarehouseRestockStore((s) => s.pickers);

  useFrame((_, dt) => {
    advance(dt);
  });

  return (
    <group>
      {pickers.map((p) => (
        <mesh key={p.id} position={[p.x, 1.45, p.z]} castShadow>
          <dodecahedronGeometry args={[0.88 + Math.min(p.restockCount, 24) * 0.012, 0]} />
          <meshStandardMaterial
            color={roleColor[p.role] ?? "#f59e0b"}
            emissive={roleColor[p.role] ?? "#f59e0b"}
            emissiveIntensity={0.55}
            metalness={0.82}
            roughness={0.28}
          />
        </mesh>
      ))}
      <VelocityWhiskers />
    </group>
  );
}
