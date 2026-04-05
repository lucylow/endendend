import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import PillarEnvironment from "./PillarEnvironment";
import CirculationSwarm from "./CirculationSwarm";
import ClearanceMetrics from "./ClearanceMetrics";
import BypassControls from "./BypassControls";
import VectorSharingPanel from "./VectorSharingPanel";
import CirculationStats from "./CirculationStats";
import { useObstacleBypassStore } from "./obstacleBypassStore";

type Props = { embedded?: boolean };

export default function CircularBypassScenario({ embedded = false }: Props) {
  const clearanceRate = useObstacleBypassStore((s) => s.clearanceRate);
  const mode = useObstacleBypassStore((s) => s.mode);
  const session = useObstacleBypassStore((s) => s.session);

  const shell = embedded
    ? "flex flex-col rounded-2xl overflow-hidden border border-zinc-800 bg-gradient-to-br from-zinc-900 via-slate-900 to-zinc-950 min-h-[56vh]"
    : "flex flex-col h-screen bg-gradient-to-br from-zinc-900 via-slate-900 to-zinc-950";

  return (
    <div className={shell}>
      <div className="flex flex-col gap-4 border-b border-zinc-800/70 bg-gradient-to-r from-zinc-950/95 via-slate-900/80 to-zinc-900/50 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-6 lg:p-8">
        <div className="space-y-2 min-w-0">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-lg">
            Circular obstacle bypass
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-zinc-400">
            <span>FoxMQ vectors → Vertex voting → emergent CCW circulation</span>
            <Badge variant="secondary" className="font-mono shrink-0">
              {clearanceRate.toFixed(0)}% rolling clearance
            </Badge>
            <Badge
              variant="outline"
              className={
                mode === "leader-follower"
                  ? "bg-orange-500/15 border-orange-500/50 text-orange-200"
                  : "bg-emerald-500/15 border-emerald-500/50 text-emerald-200"
              }
            >
              {mode}
            </Badge>
          </div>
        </div>
        <BypassControls />
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-4">
        <div className={`relative min-h-[320px] flex-1 lg:col-span-3 ${embedded ? "min-h-[40vh]" : ""}`}>
          <Canvas
            camera={{ position: [0, 22, 38], fov: 70 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            shadows
            dpr={[1, 2]}
          >
            <Suspense fallback={null}>
              <PillarEnvironment />
              <CirculationSwarm key={session} />
            </Suspense>
          </Canvas>
        </div>

        <div className="border-t border-zinc-800/50 lg:border-l lg:border-t-0 space-y-6 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-zinc-950/90 backdrop-blur-2xl">
          <ClearanceMetrics />
          <VectorSharingPanel />
          <CirculationStats />
        </div>
      </div>
    </div>
  );
}
