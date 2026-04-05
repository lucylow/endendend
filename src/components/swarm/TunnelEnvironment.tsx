import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function TunnelEnvironment() {
  const tunnelRef = useRef<THREE.Group>(null);
  const t = useRef(0);

  useFrame((state) => {
    t.current = state.clock.elapsedTime;
    if (tunnelRef.current) {
      tunnelRef.current.rotation.z = Math.sin(t.current * 0.15) * 0.04;
    }
  });

  return (
    <group ref={tunnelRef} position={[0, 0, -12]}>
      <mesh>
        <cylinderGeometry args={[24, 26, 90, 40, 1, true]} />
        <meshStandardMaterial
          color="#151825"
          emissive="#1e293b"
          emissiveIntensity={0.12}
          metalness={0.35}
          roughness={0.85}
          side={THREE.DoubleSide}
          transparent
          opacity={0.88}
        />
      </mesh>

      {Array.from({ length: 18 }, (_, i) => {
        const z = i * 5 - 42;
        const angle = i * 0.45;
        return (
          <group key={i} position={[Math.cos(angle) * 20, Math.sin(angle * 0.5) * 1.2, z]}>
            <mesh>
              <sphereGeometry args={[0.22, 10, 10]} />
              <meshStandardMaterial
                color="#f87171"
                emissive="#dc2626"
                emissiveIntensity={0.9}
              />
            </mesh>
            <pointLight intensity={0.8} distance={6} color="#fca5a5" decay={2} />
          </group>
        );
      })}

      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={`marker-${i}`} position={[0, -1.2, i * 14 - 35]} scale={0.35}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#f97316"
            emissive="#ea580c"
            emissiveIntensity={0.5}
            metalness={0.6}
            roughness={0.35}
          />
        </mesh>
      ))}
    </group>
  );
}
