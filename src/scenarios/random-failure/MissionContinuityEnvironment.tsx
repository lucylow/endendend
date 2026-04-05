import { Html } from "@react-three/drei";

export default function MissionContinuityEnvironment() {
  const checkpoints = [-40, -10, 20, 50];

  return (
    <group>
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 80]} />
        <meshStandardMaterial color="#1e293b" emissive="#334155" emissiveIntensity={0.08} />
      </mesh>

      {checkpoints.map((z, i) => (
        <group key={z} position={[0, 0, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[2, 2, 4, 16]} />
            <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.55} />
          </mesh>
          <Html position={[0, 3.2, 0]} center className="pointer-events-none whitespace-nowrap text-xs font-bold text-emerald-400 drop-shadow-md">
            CP{i + 1}
          </Html>
        </group>
      ))}

      <ambientLight intensity={0.32} />
      <directionalLight position={[40, 40, 20]} intensity={1.1} castShadow />
    </group>
  );
}
