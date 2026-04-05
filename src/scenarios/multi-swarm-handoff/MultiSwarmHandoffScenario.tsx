import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { useScenarioVizStore } from "@/store/scenarioVizStore";
import MultiSwarmHandoffScene from "./MultiSwarmHandoffScene";
import HandoffMetrics from "./HandoffMetrics";
import HandoverControls from "./HandoverControls";
import SwarmStatusComparison from "./SwarmStatusComparison";
import CoordinateTransferTimeline from "./CoordinateTransferTimeline";

export default function MultiSwarmHandoffScenario() {
  const handoffActive = useScenarioVizStore((s) => s.handoffActive);
  const zeroDowntime = useScenarioVizStore((s) => s.zeroDowntime);
  const handoffTimeMs = useScenarioVizStore((s) => s.handoffTimeMs);

  return (
    <div className="flex h-[calc(100vh-0px)] min-h-[560px] flex-col bg-gradient-to-br from-emerald-950/20 via-zinc-950 to-cyan-950/20">
      <div className="border-b border-zinc-800/50 bg-gradient-to-r from-zinc-950/95 via-emerald-950/25 to-cyan-950/25 px-4 py-6 shadow-xl backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-400 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
              Multi-swarm handover
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
              <span>Swarm A finds → FoxMQ transfer → Swarm B heavy lift</span>
              {zeroDowntime && handoffActive ? (
                <Badge className="border-emerald-400/50 bg-emerald-600/90 font-bold text-white">Zero downtime ✓</Badge>
              ) : handoffActive ? (
                <Badge variant="secondary" className="font-mono tabular-nums">
                  {handoffTimeMs.toFixed(0)}ms handoff
                </Badge>
              ) : null}
            </div>
          </div>
          <HandoverControls />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-4">
        <div className="relative min-h-[320px] lg:col-span-3">
          <Canvas
            camera={{ position: [0, 20, 50], fov: 62 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            shadows
            className="h-full w-full"
          >
            <Suspense fallback={null}>
              <MultiSwarmHandoffScene />
            </Suspense>
          </Canvas>
        </div>

        <aside className="flex flex-col gap-6 overflow-y-auto border-t border-zinc-800/50 bg-zinc-950/90 p-6 shadow-inner backdrop-blur-xl lg:border-l lg:border-t-0">
          <HandoffMetrics />
          <SwarmStatusComparison />
          <CoordinateTransferTimeline />
        </aside>
      </div>
    </div>
  );
}
