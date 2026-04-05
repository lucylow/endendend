import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import ScrollParallaxController from "./ScrollParallaxController";
import { cn } from "@/lib/utils";

interface Feature3DDemosProps {
  scrollProgressRef: React.MutableRefObject<number>;
  highlightIndex: number;
  className?: string;
}

function DemoFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#050508]">
      <div className="h-8 w-8 rounded-full border-2 border-teal-500/30 border-t-teal-400 animate-spin" aria-hidden />
      <span className="sr-only">Loading 3D preview</span>
    </div>
  );
}

export default function Feature3DDemos({ scrollProgressRef, highlightIndex, className }: Feature3DDemosProps) {
  const camera = useMemo(() => ({ position: [0, 1.6, 11] as [number, number, number], fov: 42 }), []);

  return (
    <div
      className={cn(
        "relative h-[240px] sm:h-[300px] lg:h-[340px] rounded-2xl overflow-hidden",
        "border border-white/[0.1] bg-[#030508] shadow-2xl shadow-black/50",
        className,
      )}
    >
      <div className="absolute top-3 left-3 z-10 font-mono text-[10px] uppercase tracking-[0.2em] text-teal-400/80 pointer-events-none">
        Live formation
      </div>
      <Suspense fallback={<DemoFallback />}>
        <Canvas
          className="absolute inset-0 touch-none"
          camera={camera}
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.setClearColor("#050508", 1);
          }}
        >
          <ambientLight intensity={0.35} />
          <directionalLight position={[10, 14, 8]} intensity={1.15} castShadow />
          <directionalLight position={[-6, 4, -4]} intensity={0.35} color="#a78bfa" />
          <ScrollParallaxController scrollProgressRef={scrollProgressRef} highlightIndex={highlightIndex} />
        </Canvas>
      </Suspense>
    </div>
  );
}
