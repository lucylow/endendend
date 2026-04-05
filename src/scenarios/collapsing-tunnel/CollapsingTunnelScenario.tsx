import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { OrbitControls } from "@react-three/drei";
import { Badge } from "@/components/ui/badge";
import CollapsingTunnelEnvironment from "./CollapsingTunnelEnvironment";
import RescueSwarm from "./RescueSwarm";
import RescueBeaconAnimation from "./RescueBeaconAnimation";
import RescueMetrics from "./RescueMetrics";
import DisasterControls from "./DisasterControls";
import HeartbeatStatus from "./HeartbeatStatus";
import ChainReformationTimeline from "./ChainReformationTimeline";
import { useCollapsingTunnelStore } from "./collapsingTunnelStore";

export default function CollapsingTunnelScenario() {
  const collapseTriggered = useCollapsingTunnelStore((s) => s.collapseTriggered);
  const rescueComplete = useCollapsingTunnelStore((s) => s.rescueComplete);

  return (
    <div className="flex h-[calc(100vh-0px)] min-h-[560px] flex-col bg-gradient-to-br from-slate-950/60 via-zinc-950 to-gray-950/80">
      <div className="border-b border-zinc-800/60 bg-gradient-to-r from-zinc-950/98 via-slate-900/70 to-zinc-900/90 px-4 py-6 shadow-2xl backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="bg-gradient-to-r from-slate-300 via-zinc-200 to-gray-300 bg-clip-text text-2xl font-black tracking-tight text-transparent drop-shadow-2xl sm:text-3xl">
              💥 Collapsing tunnel — dynamic debris
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
              <span>
                Instanced debris field, 100ms heartbeat awareness, automatic relay reformation, 2.1× rescue path vs
                manual planning
              </span>
              {rescueComplete ? (
                <Badge className="bg-emerald-600/90 font-bold text-white">Rescue success</Badge>
              ) : collapseTriggered ? (
                <Badge variant="destructive" className="animate-pulse font-mono">
                  Rescue in progress
                </Badge>
              ) : (
                <Badge variant="secondary">Awaiting collapse</Badge>
              )}
            </div>
          </div>
          <DisasterControls />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-4">
        <div className="relative min-h-[320px] lg:col-span-3">
          <Canvas
            camera={{ position: [18, 14, 38], fov: 52 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            shadows
            className="h-full w-full"
          >
            <Suspense fallback={null}>
              <CollapsingTunnelEnvironment />
              <RescueSwarm />
              <RescueBeaconAnimation />
              <OrbitControls enableDamping maxPolarAngle={Math.PI / 2.1} />
            </Suspense>
          </Canvas>
        </div>

        <aside className="flex flex-col gap-6 overflow-y-auto border-t border-zinc-800/40 bg-zinc-950/95 p-6 shadow-2xl backdrop-blur-xl lg:border-l lg:border-t-0">
          <RescueMetrics />
          <HeartbeatStatus />
          <ChainReformationTimeline />
        </aside>
      </div>
    </div>
  );
}
