import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { useArenaObstacleStore } from "@/store/arenaObstacleStore";
import ObstacleCourseEnvironment from "./ObstacleCourseEnvironment";
import ArenaSwarm from "./ArenaSwarm";
import CompetitionMetrics, { PathComparison, RaceLeaderboard } from "./CompetitionMetrics";
import RaceControls from "./RaceControls";
import VictoryPodium from "./VictoryPodium";

export default function ArenaObstacleScenario() {
  const raceComplete = useArenaObstacleStore((s) => s.raceComplete);

  return (
    <div className="flex h-[calc(100vh-0px)] min-h-[560px] flex-col bg-gradient-to-br from-amber-950/25 via-zinc-950 to-orange-950/20">
      <div className="border-b border-zinc-800/60 bg-gradient-to-r from-zinc-950/98 via-amber-950/35 to-zinc-900/90 px-4 py-6 shadow-xl backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300 sm:text-3xl">
              Arena obstacle course
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
              <span>10 agents · procedural warehouse · swarm vs grid A* baseline</span>
              {raceComplete ? (
                <Badge className="border-amber-400/50 bg-amber-500/90 font-bold text-zinc-950">Tashi wins</Badge>
              ) : null}
            </div>
          </div>
          <RaceControls />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-4">
        <div className="relative min-h-[320px] lg:col-span-3">
          <Canvas
            camera={{ position: [0, 32, 48], fov: 50 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            shadows
            className="h-full w-full"
          >
            <Suspense fallback={null}>
              <ObstacleCourseEnvironment />
              <ArenaSwarm />
              <VictoryPodium />
            </Suspense>
          </Canvas>
        </div>

        <aside className="flex flex-col gap-6 overflow-y-auto border-t border-zinc-800/50 bg-zinc-950/90 p-6 shadow-inner backdrop-blur-xl lg:border-l lg:border-t-0">
          <CompetitionMetrics />
          <RaceLeaderboard />
          <PathComparison />
        </aside>
      </div>
    </div>
  );
}
