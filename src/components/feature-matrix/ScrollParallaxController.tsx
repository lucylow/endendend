import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const DRONE_COUNT = 5;

function DroneMesh({ color }: { color: THREE.ColorRepresentation }) {
  const body = useMemo(() => new THREE.BoxGeometry(0.55, 0.28, 0.85), []);
  const arm = useMemo(() => new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0c1218",
        metalness: 0.88,
        roughness: 0.18,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.45,
      }),
    [color],
  );
  const armMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#151d28",
        metalness: 0.75,
        roughness: 0.35,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.12,
      }),
    [color],
  );

  return (
    <group>
      <mesh geometry={body} material={mat} castShadow receiveShadow />
      <mesh geometry={arm} material={armMat} position={[0.52, 0.1, 0]} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={arm} material={armMat} position={[-0.52, 0.1, 0]} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={arm} material={armMat} position={[0, 0.1, 0.52]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={arm} material={armMat} position={[0, 0.1, -0.52]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

interface ScrollParallaxControllerProps {
  scrollProgressRef: React.MutableRefObject<number>;
  /** Highlight index 0..n-1 based on showcased capability */
  highlightIndex?: number;
}

/**
 * R3F-only: reads scroll progress from a ref updated by the parent (Framer scrollYProgress).
 */
export default function ScrollParallaxController({ scrollProgressRef, highlightIndex = 0 }: ScrollParallaxControllerProps) {
  const groupRef = useRef<THREE.Group>(null);

  const colors = useMemo(
    () => ["#2dd4bf", "#34d399", "#a78bfa", "#f472b6", "#38bdf8"].map((c) => new THREE.Color(c)),
    [],
  );

  useFrame((state) => {
    const root = groupRef.current;
    if (!root) return;

    const progress = scrollProgressRef.current;
    const t = state.clock.elapsedTime;

    root.rotation.y = progress * 0.55 + Math.sin(t * 0.15) * 0.04;
    root.position.z = -progress * 3.2;
    root.position.y = Math.sin(progress * Math.PI) * 0.35;

    const hi = ((highlightIndex % DRONE_COUNT) + DRONE_COUNT) % DRONE_COUNT;

    root.children.forEach((child, i) => {
      if (!(child instanceof THREE.Group)) return;
      const phase = progress * Math.PI * 2 + i * 0.9;
      child.position.y = Math.sin(phase + t * 0.8) * 0.28 + i * 0.05;
      child.rotation.x = Math.sin(t * 0.4 + i) * 0.08;
      child.rotation.z = Math.cos(t * 0.35 + i * 0.5) * 0.06;

      const mesh = child.children[0] as THREE.Mesh | undefined;
      const mat = mesh?.material as THREE.MeshStandardMaterial | undefined;
      if (!mat) return;
      const hot = i === hi;
      mat.emissiveIntensity = hot ? 0.88 + Math.sin(t * 3) * 0.14 : 0.34;
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: DRONE_COUNT }, (_, i) => {
        const angle = (i / DRONE_COUNT) * Math.PI * 2;
        const r = 2.8;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r * 0.85;
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, -angle + Math.PI / 2, 0]}>
            <DroneMesh color={colors[i % colors.length]} />
          </group>
        );
      })}
    </group>
  );
}
