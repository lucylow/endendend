import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useCollapsingTunnelStore } from "./collapsingTunnelStore";

const DEBRIS_COUNT = 150;
/** Collapse epicenter (aligned with rear trapped agents). */
const COLLAPSE_Z = -42;

export default function CollapsingTunnelEnvironment() {
  const collapseTriggered = useCollapsingTunnelStore((s) => s.collapseTriggered);
  const collapseRef = useRef<THREE.Group>(null);
  const debrisPool = useRef<THREE.InstancedMesh>(null);

  const [debrisGeo, debrisMat] = useMemo(() => {
    const g = new THREE.BoxGeometry(1.5, 1, 2);
    const m = new THREE.MeshStandardMaterial({ color: "#4a5568", roughness: 0.9 });
    return [g, m];
  }, []);

  const dummy = useMemo(() => new THREE.Matrix4(), []);

  useFrame((state) => {
    const inst = debrisPool.current;
    if (inst) inst.count = collapseTriggered ? DEBRIS_COUNT : 0;

    if (!collapseRef.current || !collapseTriggered) {
      if (collapseRef.current) {
        collapseRef.current.rotation.z = 0;
        collapseRef.current.position.y = 0;
      }
      return;
    }

    collapseRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 20) * 0.05;
    collapseRef.current.position.y = Math.sin(state.clock.elapsedTime * 15) * 0.1;

    if (!inst) return;

    for (let i = 0; i < DEBRIS_COUNT; i++) {
      const time = state.clock.elapsedTime * 3 + i;
      const debrisX = Math.sin(time + i) * 6.5;
      const debrisY = Math.sin(time * 1.5 + i * 0.3) * 2.2;
      const debrisZ = COLLAPSE_Z + Math.cos(time * 0.8 + i) * 5;
      dummy.makeTranslation(debrisX, debrisY, debrisZ);
      inst.setMatrixAt(i, dummy);
    }
    inst.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -8]} receiveShadow>
        <planeGeometry args={[24, 120]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} metalness={0.05} />
      </mesh>

      <mesh position={[-7, 2.5, -8]} receiveShadow castShadow>
        <boxGeometry args={[0.4, 5, 110]} />
        <meshStandardMaterial color="#334155" roughness={0.75} />
      </mesh>
      <mesh position={[7, 2.5, -8]} receiveShadow castShadow>
        <boxGeometry args={[0.4, 5, 110]} />
        <meshStandardMaterial color="#334155" roughness={0.75} />
      </mesh>
      <mesh position={[0, 5.2, -8]} receiveShadow>
        <boxGeometry args={[14.4, 0.35, 110]} />
        <meshStandardMaterial color="#475569" roughness={0.8} />
      </mesh>

      <mesh position={[0, 2.8, 34]} rotation={[0, 0, 0]}>
        <torusGeometry args={[4.2, 0.25, 12, 40]} />
        <meshStandardMaterial color="#34d399" emissive="#10b981" emissiveIntensity={0.6} />
      </mesh>

      <group ref={collapseRef} position={[0, 0, 0]}>
        <mesh position={[0, 2.5, COLLAPSE_Z]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[6.5, 6.5, 18, 32, 1, true]} />
          <meshStandardMaterial
            color="#2d3748"
            emissive={collapseTriggered ? "#b91c1c" : "#1e293b"}
            emissiveIntensity={collapseTriggered ? 0.4 : 0.05}
            transparent
            opacity={0.92}
            side={THREE.DoubleSide}
          />
        </mesh>

        <instancedMesh ref={debrisPool} args={[debrisGeo, debrisMat, DEBRIS_COUNT]} frustumCulled={false} />
      </group>

      <group position={[0, 2.5, 32]}>
        <mesh>
          <cylinderGeometry args={[2.2, 2.2, 5, 24]} />
          <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.8} />
        </mesh>
        <pointLight intensity={4} color="#10b981" distance={30} />
      </group>

      {Array.from({ length: 22 }).map((_, i) => (
        <mesh
          key={i}
          position={[Math.sin(i * 0.35) * 6.2, 2.2 + Math.cos(i * 0.28) * 0.35, 28 - i * 5.2]}
        >
          <sphereGeometry args={[0.22, 8, 8]} />
          <meshBasicMaterial color="#f59e0b" />
          <pointLight intensity={0.85} distance={14} color="#f59e0b" />
        </mesh>
      ))}

      <ambientLight intensity={0.45} />
      <directionalLight position={[-6, 22, 18]} intensity={0.75} castShadow />
      <pointLight position={[0, 3, 32]} intensity={1.1} color="#6ee7b7" distance={40} />
      <fog attach="fog" args={["#0f172a", 28, 95]} />
    </group>
  );
}
