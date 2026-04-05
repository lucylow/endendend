import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useArenaObstacleStore } from "@/store/arenaObstacleStore";

function ConfettiBits({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const parts = useRef(
    Array.from({ length: 24 }, (_, i) => ({
      seed: i * 0.41,
      c: new THREE.Color().setHSL((i * 0.07) % 1, 0.85, 0.55),
    })),
  ).current;

  useFrame(() => {
    if (!active || !group.current) return;
    const t = performance.now() * 0.001;
    group.current.children.forEach((ch, i) => {
      const p = parts[i];
      if (!p) return;
      const a = t * 2 + p.seed * 10;
      ch.position.set(Math.cos(a) * (2.5 + p.seed * 3), (t % 4) * 1.8 + p.seed * 2, Math.sin(a * 0.85) * (2 + p.seed * 2.5));
    });
  });

  if (!active) return null;
  return (
    <group position={[45, 2, 0]} ref={group}>
      {parts.map((p, i) => (
        <mesh key={i} scale={0.12}>
          <boxGeometry />
          <meshStandardMaterial color={p.c} emissive={p.c} emissiveIntensity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

export default function VictoryPodium() {
  const raceComplete = useArenaObstacleStore((s) => s.raceComplete);
  const firstPlaceId = useArenaObstacleStore((s) => s.firstPlaceId);

  if (!raceComplete) return null;

  return (
    <group position={[45, 0, 0]}>
      <mesh position={[0, 2.8, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.8, 3.2, 5.2, 28]} />
        <meshStandardMaterial color="#fbbf24" emissive="#b45309" emissiveIntensity={0.35} metalness={0.6} roughness={0.35} />
      </mesh>
      {firstPlaceId ? (
        <mesh position={[0, 6.2, 0]} castShadow>
          <dodecahedronGeometry args={[1.4, 0]} />
          <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={0.8} metalness={0.9} roughness={0.2} />
        </mesh>
      ) : null}
      <pointLight position={[0, 8, 0]} intensity={1.8} color="#fcd34d" distance={22} />
      <ConfettiBits active />
    </group>
  );
}
