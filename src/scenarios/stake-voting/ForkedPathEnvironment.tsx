import { Html } from "@react-three/drei";

const pathA = { end: [-30, 0, 30] as const, color: "#ef4444", label: "Risky (longer)" };
const pathB = { end: [30, 0, 30] as const, color: "#10b981", label: "Optimal (shorter)" };

export default function ForkedPathEnvironment() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshLambertMaterial color="#111827" />
      </mesh>

      <group>
        <mesh position={[-7, 0.02, 15]} rotation={[-Math.PI / 2, 0, -Math.PI / 4]}>
          <planeGeometry args={[4, 32]} />
          <meshStandardMaterial
            color={pathA.color}
            emissive={pathA.color}
            emissiveIntensity={0.35}
            metalness={0.2}
            roughness={0.65}
          />
        </mesh>
        <mesh position={pathA.end}>
          <cylinderGeometry args={[2, 2, 4, 16]} />
          <meshStandardMaterial color={pathA.color} emissive={pathA.color} emissiveIntensity={0.55} metalness={0.4} />
        </mesh>
        <Html position={[-30, 3.2, 30]} center distanceFactor={14}>
          <div className="rounded-lg border border-red-500/40 bg-black/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-200">
            {pathA.label}
          </div>
        </Html>
      </group>

      <group>
        <mesh position={[7, 0.02, 15]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <planeGeometry args={[4, 32]} />
          <meshStandardMaterial
            color={pathB.color}
            emissive={pathB.color}
            emissiveIntensity={0.35}
            metalness={0.2}
            roughness={0.65}
          />
        </mesh>
        <mesh position={pathB.end}>
          <cylinderGeometry args={[2, 2, 4, 16]} />
          <meshStandardMaterial color={pathB.color} emissive={pathB.color} emissiveIntensity={0.55} metalness={0.4} />
        </mesh>
        <Html position={[30, 3.2, 30]} center distanceFactor={14}>
          <div className="rounded-lg border border-emerald-500/40 bg-black/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
            {pathB.label}
          </div>
        </Html>
      </group>

      <group position={[0, 0, 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[3, 3, 1, 24]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.65} metalness={0.3} />
        </mesh>
        <Html position={[0, 2.2, 0]} center distanceFactor={16}>
          <div className="rounded-lg border border-amber-400/50 bg-zinc-950/90 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-amber-200 shadow-lg">
            Decision point
          </div>
        </Html>
      </group>

      <ambientLight intensity={0.35} />
      <directionalLight position={[18, 32, 12]} intensity={1.1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
    </group>
  );
}
