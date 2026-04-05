import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Dual-shell pulse + wireframe burst for critical vitals */
export function CriticalFlash3D() {
  const shellRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const shell = shellRef.current;
    const wire = wireRef.current;
    const ring = ringRef.current;
    if (shell) {
      const mat = shell.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.06 + Math.abs(Math.sin(t * 5.5)) * 0.18;
      const s = 0.98 + Math.sin(t * 7) * 0.06;
      shell.scale.setScalar(s);
    }
    if (wire) {
      const wm = wire.material as THREE.MeshBasicMaterial;
      wm.opacity = 0.04 + Math.abs(Math.sin(t * 8 + 1)) * 0.12;
    }
    if (ring) {
      const rm = ring.material as THREE.MeshBasicMaterial;
      const wave = (Math.sin(t * 4.2) + 1) * 0.5;
      rm.opacity = 0.05 + wave * 0.14;
      ring.scale.setScalar(1.02 + wave * 0.38);
    }
  });

  return (
    <group>
      <mesh ref={shellRef}>
        <sphereGeometry args={[0.92, 24, 24]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <mesh ref={wireRef}>
        <sphereGeometry args={[0.98, 12, 12]} />
        <meshBasicMaterial color="#fca5a5" transparent opacity={0.08} wireframe depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.88, 0.95, 32]} />
        <meshBasicMaterial color="#f87171" transparent opacity={0.15} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
