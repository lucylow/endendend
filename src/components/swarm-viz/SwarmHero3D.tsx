import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { motion, useScroll, useTransform } from "framer-motion";

function SwarmNodes({ count = 48 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const color = useMemo(() => new THREE.Color(), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const m = meshRef.current;
    if (!m) return;
    const t = state.clock.elapsedTime * 0.35;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 3.2 + Math.sin(t + i * 0.2) * 0.35;
      dummy.position.set(Math.cos(a + t) * r, Math.sin(i * 1.7 + t * 0.8) * 0.8, Math.sin(a + t) * r);
      dummy.rotation.set(t * 0.2 + i * 0.05, t * 0.15, 0);
      const s = 0.12 + (i % 5) * 0.02;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.45 + (i % 7) * 0.02, 0.75, 0.55);
      m.setColorAt(i, color);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial emissive="#0d4f4a" emissiveIntensity={0.6} metalness={0.35} roughness={0.35} />
    </instancedMesh>
  );
}

function Scene() {
  return (
    <>
      <color attach="background" args={["#05050c"]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[8, 14, 6]} intensity={1.1} castShadow />
      <pointLight position={[-6, 4, -4]} intensity={0.6} color="#22d3ee" />
      <Float speed={1.2} rotationIntensity={0.35} floatIntensity={0.4}>
        <SwarmNodes />
      </Float>
      <Stars radius={80} depth={40} count={1800} factor={3} saturation={0} fade speed={0.4} />
      <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.35} enablePan={false} maxPolarAngle={Math.PI / 1.9} minPolarAngle={Math.PI / 3.5} />
    </>
  );
}

export function SwarmHero3D() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [0.72, 1.22]);
  const y = useTransform(scrollYProgress, [0, 1], [0, -40]);

  return (
    <div ref={ref} className="relative h-[min(72vh,640px)] w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-black/40 shadow-[var(--glow-primary)]">
      <motion.div style={{ scale, y }} className="absolute inset-0">
        <Canvas camera={{ position: [0, 2.8, 10.5], fov: 52 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </motion.div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-zinc-950/30" />
    </div>
  );
}
