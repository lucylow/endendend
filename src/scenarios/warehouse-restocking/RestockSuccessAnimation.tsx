import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWarehouseRestockStore } from "@/store/warehouseRestockStore";

export default function RestockSuccessAnimation() {
  const total = useWarehouseRestockStore((s) => s.totalRestocks);
  const meshRef = useRef<THREE.Mesh>(null);
  const lastMilestone = useRef(0);
  const pulse = useRef(0);

  useFrame((_, dt) => {
    const m = Math.floor(total / 40);
    if (m > lastMilestone.current) {
      lastMilestone.current = m;
      pulse.current = 1;
    }
    pulse.current = Math.max(0, pulse.current - dt * 1.8);
    const s = meshRef.current;
    if (!s) return;
    const sc = 1 + pulse.current * 4.5;
    s.scale.setScalar(sc);
    const mat = s.material as THREE.MeshBasicMaterial;
    mat.opacity = pulse.current * 0.35;
  });

  return (
    <mesh ref={meshRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[18, 42, 48]} />
      <meshBasicMaterial color="#34d399" transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
