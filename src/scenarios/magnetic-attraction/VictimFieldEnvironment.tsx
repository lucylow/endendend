import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useMagneticAttractionStore } from "./magneticAttractionStore";

function VictimTarget({
  id,
  position,
  value,
  color,
}: {
  id: string;
  position: [number, number, number];
  value: number;
  color: string;
}) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[1.5 * (0.35 + value), 1.5 * (0.35 + value), 3.2, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={value * 0.75}
          metalness={0.25}
          roughness={0.42}
        />
      </mesh>
      <pointLight intensity={value * 2.2} color={color} distance={22} decay={2} />
      <mesh>
        <sphereGeometry args={[value * 14 + 2, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.07} wireframe depthWrite={false} />
      </mesh>
      <Html position={[0, 2.4, 0]} center distanceFactor={12}>
        <div className="rounded-md border border-white/20 bg-black/75 px-2 py-1 font-mono text-[10px] font-bold text-white shadow-lg backdrop-blur-sm">
          {id} · {(value * 100).toFixed(0)}
        </div>
      </Html>
    </group>
  );
}

export default function VictimFieldEnvironment() {
  const victims = useMagneticAttractionStore((s) => s.victims);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <planeGeometry args={[110, 110]} />
        <meshLambertMaterial color="#0f172a" transparent opacity={0.97} />
      </mesh>
      <gridHelper args={[100, 20]} position={[0, 0.02, 0]} rotation={new THREE.Euler(-Math.PI / 2, 0, 0)} />
      {victims.map((victim) => (
        <VictimTarget
          key={victim.id}
          id={victim.id}
          position={[victim.x, 1.6, victim.z]}
          value={victim.value}
          color={victim.color}
        />
      ))}
      <ambientLight intensity={0.38} />
      <directionalLight position={[50, 55, 28]} intensity={1.05} castShadow />
    </group>
  );
}
