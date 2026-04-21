import { useMemo } from "react";
import * as THREE from "three";

export interface Tunnel3DProps {
  /** Nominal tunnel length along -Z visualization (m). */
  depthM?: number;
  widthM?: number;
  /** Optional collapse markers (0–depth). */
  collapseAt?: number[];
}

/** Procedural tunnel shell: instanced slabs + entrance glow. */
export function Tunnel3D({ depthM = 200, widthM = 10, collapseAt = [] }: Tunnel3DProps) {
  const segments = useMemo(() => {
    const n = 14;
    const dz = depthM / n;
    return { n, dz };
  }, [depthM]);

  const collapseMeshes = useMemo(() => {
    return collapseAt.map((s, i) => (
      <mesh key={`c-${i}`} position={[0, 1.1, -s * 0.12]}>
        <boxGeometry args={[widthM * 0.85, 2.2, 2.4]} />
        <meshStandardMaterial color="#5c4033" roughness={0.98} metalness={0.02} transparent opacity={0.55} />
      </mesh>
    ));
  }, [collapseAt, widthM]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 4]}>
        <planeGeometry args={[widthM * 6, depthM * 0.14 + 40]} />
        <meshStandardMaterial color="#141418" roughness={1} metalness={0} />
      </mesh>
      {Array.from({ length: segments.n }).map((_, i) => {
        const z = -i * segments.dz - segments.dz * 0.5;
        const shade = 0.14 + 0.55 * (i / Math.max(1, segments.n - 1));
        const c = new THREE.Color().setRGB(shade * 0.85, shade * 0.88, shade * 0.95);
        return (
          <mesh key={i} position={[0, 2.2, z]}>
            <boxGeometry args={[widthM + 1.2, 5.2, segments.dz + 0.4]} />
            <meshStandardMaterial color={c} roughness={0.92} metalness={0.03} />
          </mesh>
        );
      })}
      {collapseMeshes}
      <pointLight position={[0, 6, 2]} intensity={0.9} distance={35} color="#fff8e1" />
    </group>
  );
}
