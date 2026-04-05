import { Canvas } from "@react-three/fiber";
import { Environment, ContactShadows, Preload } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import SwarmFormation from "./SwarmFormation";
import HealthIndicators from "./HealthIndicators";
import ConnectionMatrix from "./ConnectionMatrix";
import ScrollCameraController from "./ScrollCameraController";
import { useSwarmStore } from "@/store/swarmStore";

function HeroScene() {
  const agents = useSwarmStore((s) => s.agents);
  const eventSource = useMemo(() => document.getElementById("root") ?? undefined, []);

  return (
    <Canvas
      className="h-full w-full touch-none"
      camera={{ position: [0, 10, 25], fov: 58, near: 0.1, far: 120 }}
      dpr={[1, Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1)]}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        alpha: false,
        toneMapping: ACESFilmicToneMapping,
        outputColorSpace: SRGBColorSpace,
      }}
      shadows
      eventSource={eventSource}
    >
      <Suspense fallback={null}>
        <Environment preset="city" />
        <color attach="background" args={["#060a14"]} />
        <fog attach="fog" args={["#060a14", 14, 60]} />

        <directionalLight
          position={[18, 28, 12]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.5}
          shadow-camera-far={90}
          shadow-camera-left={-32}
          shadow-camera-right={32}
          shadow-camera-top={32}
          shadow-camera-bottom={-32}
          color="#c8e0ff"
        />
        <directionalLight position={[-12, 18, -8]} intensity={0.4} color="#67e8f9" />
        <ambientLight intensity={0.2} />
        <pointLight position={[-16, 8, 8]} intensity={0.6} color="#22d3ee" distance={70} decay={2} />
        <pointLight position={[14, 5, -10]} intensity={0.35} color="#a78bfa" distance={50} decay={2} />

        <SwarmFormation agents={agents} />
        <HealthIndicators agents={agents} />
        <ConnectionMatrix agents={agents} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.2, 0]} receiveShadow>
          <planeGeometry args={[90, 90]} />
          <meshStandardMaterial color="#0a0e1a" metalness={0.4} roughness={0.95} />
        </mesh>

        {/* Grid lines on ground */}
        <gridHelper args={[80, 40, "#1e293b", "#111827"]} position={[0, -3.18, 0]} />

        <ContactShadows position={[0, -2.85, 0]} opacity={0.45} scale={45} blur={2} frames={1} />

        <ScrollCameraController />
        <Preload all />
      </Suspense>
    </Canvas>
  );
}

export default function HeroSwarm({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <HeroScene />
    </div>
  );
}
