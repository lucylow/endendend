import * as THREE from "three";

export default function ThermalEnvironment() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color="#0c1222" metalness={0.2} roughness={0.85} />
      </mesh>
      <gridHelper args={[80, 40]} position={[0, 0.01, 0]} rotation={new THREE.Euler(-Math.PI / 2, 0, 0)} />
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[1.2, 1.6, 0.7, 24]} />
        <meshStandardMaterial
          color="#f97316"
          emissive="#ea580c"
          emissiveIntensity={1.2}
          metalness={0.4}
          roughness={0.35}
        />
      </mesh>
      <pointLight position={[0, 2.5, 0]} intensity={2.2} color="#fdba74" distance={28} decay={2} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[18, 28, 14]} intensity={0.85} castShadow />
    </group>
  );
}
