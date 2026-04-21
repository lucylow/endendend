import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function RoverMesh({
  position,
  scale = 1,
  color,
  pulse = false,
}: {
  position: [number, number, number];
  scale?: number;
  color: string;
  pulse?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);

  useFrame(({ clock }) => {
    const m = meshRef.current;
    const mat = matRef.current;
    if (!m || !mat) return;
    if (pulse) {
      mat.emissiveIntensity = 0.25 + 0.2 * Math.sin(clock.elapsedTime * 6);
    } else {
      mat.emissiveIntensity = 0;
    }
  });

  return (
    <mesh ref={meshRef} position={position} scale={Math.max(0.35, scale)}>
      <boxGeometry args={[1.2, 0.65, 0.85]} />
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={pulse ? "#334433" : "#000000"}
        metalness={0.2}
        roughness={0.45}
      />
    </mesh>
  );
}
