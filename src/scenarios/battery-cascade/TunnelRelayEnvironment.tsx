import { useRef } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";

export default function TunnelRelayEnvironment() {
  const tunnelRef = useRef<THREE.Group>(null);
  const relayPositions = [-20, -40, -60, -80, -100, -120];

  return (
    <group ref={tunnelRef}>
      <ambientLight intensity={0.25} />
      <directionalLight position={[8, 24, 12]} intensity={0.9} castShadow shadow-mapSize={[1024, 1024]} />
      <fog attach="fog" args={["#0a0a0f", 28, 160]} />

      <mesh position={[0, 0, -90]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[15, 15, 40, 32, 1, true]} />
        <meshStandardMaterial
          color="#1e1b4b"
          emissive="#7c2d12"
          emissiveIntensity={0.25}
          transparent
          opacity={0.88}
          side={THREE.DoubleSide}
        />
      </mesh>

      {relayPositions.map((z, i) => (
        <group key={i} position={[0, 0, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[2, 2, 4, 16]} />
            <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.55} />
          </mesh>
          <Html position={[0, 3.2, 0]} center className="pointer-events-none select-none">
            <div className="rounded bg-emerald-950/90 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300 ring-1 ring-emerald-500/40">
              RELAY {i + 1}
            </div>
          </Html>
        </group>
      ))}

      {Array.from({ length: 25 }).map((_, i) => (
        <group
          key={i}
          position={[Math.sin(i * 0.3) * 14, Math.cos(i * 0.3) * 2, i * 8 - 120]}
        >
          <mesh>
            <sphereGeometry args={[0.28, 10, 10]} />
            <meshStandardMaterial color="#f87171" emissive="#7f1d1d" emissiveIntensity={0.9} />
          </mesh>
          <pointLight intensity={0.85} distance={9} color="#f87171" decay={2} />
        </group>
      ))}
    </group>
  );
}
