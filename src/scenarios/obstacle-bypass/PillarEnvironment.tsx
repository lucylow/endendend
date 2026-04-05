export default function PillarEnvironment() {
  return (
    <group rotation={[0, Math.PI / 4, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshLambertMaterial color="#1f2937" transparent opacity={0.92} />
      </mesh>

      <group position={[0, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[8, 8, 16, 24]} />
          <meshStandardMaterial color="#4b5563" roughness={0.82} metalness={0.12} />
        </mesh>
        <mesh position={[0, 9, 0]} castShadow>
          <cylinderGeometry args={[9, 9, 2, 24]} />
          <meshStandardMaterial color="#6b7280" roughness={0.72} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 8]}>
          <torusGeometry args={[8.5, 0.45, 8, 24]} />
          <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" emissiveIntensity={0.35} />
        </mesh>
      </group>

      <gridHelper args={[120, 12, 0x334155, 0x1e293b]} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} />

      <ambientLight intensity={0.42} />
      <directionalLight
        position={[30, 40, 20]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
    </group>
  );
}
