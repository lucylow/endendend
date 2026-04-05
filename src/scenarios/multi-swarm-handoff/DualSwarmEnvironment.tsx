import { Html } from "@react-three/drei";
import * as THREE from "three";

const targetZone = new THREE.Vector3(0, 0, 0);

export default function DualSwarmEnvironment() {
  return (
    <group>
      <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[72, 72]} />
        <meshStandardMaterial color="#1e293b" metalness={0.15} roughness={0.88} />
      </mesh>

      <group position={targetZone}>
        <mesh castShadow position={[0, 1, 0]}>
          <boxGeometry args={[7, 2, 5]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.12} roughness={0.72} />
        </mesh>
        <pointLight intensity={1.6} color="#fbbf24" distance={22} position={[0, 3, 0]} />
        <Html position={[0, 4.2, 0]} center distanceFactor={12}>
          <div className="rounded-lg border border-amber-400/40 bg-zinc-950/90 px-2 py-1 text-[10px] font-bold text-amber-200 shadow-xl whitespace-nowrap">
            HEAVY LIFT TARGET
          </div>
        </Html>
      </group>

      <mesh position={[-32, 0.02, 22]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 18]} />
        <meshStandardMaterial color="#10b981" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <Html position={[-32, 0.5, 22]} center distanceFactor={14}>
        <div className="rounded-md border border-emerald-500/50 bg-emerald-950/85 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
          SWARM A
        </div>
      </Html>

      <mesh position={[32, 0.02, -22]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 18]} />
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <Html position={[32, 0.5, -22]} center distanceFactor={14}>
        <div className="rounded-md border border-blue-500/50 bg-blue-950/85 px-2 py-0.5 text-[10px] font-bold text-blue-300">
          SWARM B
        </div>
      </Html>

      <mesh position={[targetZone.x, 0.04, targetZone.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[10, 12.5, 40]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
