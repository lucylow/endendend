import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useScenarioVizStore } from "@/store/scenarioVizStore";

/**
 * Beacon pulse when FoxMQ handoff commits — visible in SAR canvas and full-page demo.
 */
export default function HandoffSuccessAnimation() {
  const ringRef = useRef<THREE.Mesh>(null);
  const handoffActive = useScenarioVizStore((s) => s.handoffActive);

  useFrame((state) => {
    const mesh = ringRef.current;
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    if (handoffActive) {
      const t = state.clock.elapsedTime;
      const pulse = 1 + Math.sin(t * 5) * 0.12;
      mesh.scale.set(pulse, pulse, 1);
      mat.opacity = 0.28 + Math.sin(t * 4.2) * 0.12;
    } else {
      mesh.scale.set(1, 1, 1);
      mat.opacity = 0.12;
    }
  });

  return (
    <mesh ref={ringRef} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[14, 16.5, 48]} />
      <meshBasicMaterial color="#34d399" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}
