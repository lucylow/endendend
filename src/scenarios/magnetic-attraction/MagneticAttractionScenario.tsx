import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { OrbitControls } from "@react-three/drei";
import { Badge } from "@/components/ui/badge";
import VictimFieldEnvironment from "./VictimFieldEnvironment";
import MagneticSwarm from "./MagneticSwarm";
import SelectionMetrics from "./SelectionMetrics";
import PriorityControls from "./PriorityControls";
import AttractionFieldVisualization from "./AttractionFieldVisualization";
import VictimPriorityRanking from "./VictimPriorityRanking";
import AttractionFieldStats from "./AttractionFieldStats";
import { useMagneticAttractionStore } from "./magneticAttractionStore";

export default function MagneticAttractionScenario() {
  const optimalSelectionRate = useMagneticAttractionStore((s) => s.optimalSelectionRate);

  return (
    <div className="flex h-[calc(100vh-0px)] min-h-[560px] flex-col bg-gradient-to-br from-purple-950/25 via-zinc-950 to-indigo-950/20">
      <div className="border-b border-zinc-800/50 bg-gradient-to-r from-zinc-950/95 via-purple-900/30 to-zinc-950/80 px-4 py-6 shadow-2xl backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-2xl font-black tracking-tight text-transparent drop-shadow-2xl sm:text-3xl">
              Magnetic victim attraction
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
              <span>Multi-victim arena · Vertex-style stake weighting · visible pull vectors</span>
              <Badge variant="secondary" className="font-mono">
                {optimalSelectionRate.toFixed(0)}% field score
              </Badge>
            </div>
          </div>
          <PriorityControls />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-4">
        <div className="relative min-h-[320px] lg:col-span-3">
          <Canvas
            camera={{ position: [0, 26, 46], fov: 68 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            shadows
            className="h-full w-full"
          >
            <Suspense fallback={null}>
              <VictimFieldEnvironment />
              <MagneticSwarm />
              <AttractionFieldVisualization />
              <OrbitControls enableDamping maxPolarAngle={Math.PI / 2.08} />
            </Suspense>
          </Canvas>
        </div>

        <aside className="flex flex-col gap-8 overflow-y-auto border-t border-zinc-800/40 bg-zinc-950/95 p-6 shadow-2xl backdrop-blur-xl lg:border-l lg:border-t-0">
          <SelectionMetrics />
          <VictimPriorityRanking />
          <AttractionFieldStats />
        </aside>
      </div>
    </div>
  );
}
