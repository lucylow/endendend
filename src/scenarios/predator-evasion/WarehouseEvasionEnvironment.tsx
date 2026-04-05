import { Html } from "@react-three/drei";
import { usePredatorEvasionStore } from "./predatorEvasionStore";

export default function WarehouseEvasionEnvironment() {
  const forklift = usePredatorEvasionStore((s) => s.forklift);
  const threatActive = usePredatorEvasionStore((s) => s.threatActive);

  return (
    <group>
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 96]} />
        <meshStandardMaterial color="#1e293b" metalness={0.15} roughness={0.88} />
      </mesh>

      <mesh position={[0, 0.02, -22]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 48]} />
        <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.22} metalness={0.12} roughness={0.72} />
      </mesh>
      <Html position={[0, 0.4, -22]} center distanceFactor={20}>
        <div className="rounded border border-emerald-500/40 bg-black/75 px-2 py-1 text-[10px] font-mono text-emerald-200">Mission corridor</div>
      </Html>

      <group position={[forklift.x, 0, forklift.z]}>
        <mesh castShadow position={[0, 1.5, 0]}>
          <boxGeometry args={[6, 3, 12]} />
          <meshStandardMaterial
            color="#dc2626"
            emissive="#dc2626"
            emissiveIntensity={threatActive ? 0.5 : 0.12}
            metalness={0.55}
            roughness={0.38}
          />
        </mesh>
        <mesh position={[0, 0, 6]}>
          <boxGeometry args={[8, 1, 2]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.28} />
        </mesh>
        <mesh position={[-1.5, 2.5, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.9, 8]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={threatActive ? 1 : 0.25} />
        </mesh>
        <mesh position={[1.5, 2.5, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.9, 8]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={threatActive ? 1 : 0.25} />
        </mesh>
        <mesh scale={[1, 0.35, 1.2]} visible={threatActive}>
          <sphereGeometry args={[8, 18, 14]} />
          <meshBasicMaterial color="#dc2626" transparent opacity={0.1} depthWrite={false} />
        </mesh>
        <Html position={[0, 4.2, 0]} center distanceFactor={14}>
          <div className="rounded border border-red-500/50 bg-red-950/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-200">
            {threatActive ? "Threat · forklift" : "Forklift (idle)"}
          </div>
        </Html>
      </group>

      <ambientLight intensity={0.34} />
      <directionalLight position={[28, 40, 18]} intensity={1.05} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <pointLight position={[forklift.x, 6, forklift.z]} intensity={threatActive ? 1.1 : 0.25} color={threatActive ? "#fecaca" : "#e2e8f0"} distance={44} />
    </group>
  );
}
