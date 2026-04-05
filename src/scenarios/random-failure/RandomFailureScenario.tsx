import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import MissionContinuityEnvironment from "./MissionContinuityEnvironment";
import SelfHealingSwarm from "./SelfHealingSwarm";
import ResilienceMetrics from "./ResilienceMetrics";
import ResilienceControls from "./ResilienceControls";
import FailureHistory from "./FailureHistory";
import PerformanceContinuityChart from "./PerformanceContinuityChart";
import { useRandomFailureStore } from "./randomFailureStore";

type Props = {
  embedded?: boolean;
};

export default function RandomFailureScenario({ embedded = false }: Props) {
  const performanceUptime = useRandomFailureStore((s) => s.performanceUptime);
  const session = useRandomFailureStore((s) => s.session);

  const shell = embedded
    ? "flex min-h-[56vh] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-gray-950/50 to-zinc-950"
    : "flex h-screen flex-col bg-gradient-to-br from-zinc-900 via-gray-950/50 to-zinc-950";

  return (
    <div className={shell}>
      <div className="flex flex-col gap-4 border-b border-zinc-800/60 bg-gradient-to-r from-zinc-950/98 via-gray-900/70 to-zinc-900/90 p-4 backdrop-blur-xl shadow-2xl sm:flex-row sm:items-center sm:justify-between sm:p-6 lg:p-8">
        <div className="min-w-0 space-y-2">
          <h1 className="bg-gradient-to-r from-gray-400 via-zinc-300 to-slate-400 bg-clip-text text-2xl font-black text-transparent drop-shadow-2xl sm:text-3xl">
            Random leader failure
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 sm:text-sm">
            <span>40% agent loss → 98.7% performance narrative → zero intervention</span>
            <Badge className="shrink-0 bg-emerald-500/90 font-bold text-white">{performanceUptime.toFixed(1)}% uptime</Badge>
          </div>
        </div>
        <ResilienceControls />
      </div>

      <div className="grid min-h-0 flex-1 flex-col lg:grid-cols-4">
        <div className={`relative min-h-[320px] flex-1 lg:col-span-3 ${embedded ? "min-h-[40vh]" : ""}`}>
          <Canvas camera={{ position: [0, 15, 35], fov: 75 }} gl={{ antialias: true }} shadows dpr={[1, 2]}>
            <Suspense fallback={null}>
              <MissionContinuityEnvironment />
              <SelfHealingSwarm key={session} />
            </Suspense>
          </Canvas>
        </div>

        <div className="space-y-6 overflow-y-auto border-t border-zinc-800/40 bg-zinc-950/95 p-4 backdrop-blur-3xl sm:p-6 lg:border-l lg:border-t-0 lg:p-8">
          <ResilienceMetrics />
          <FailureHistory />
          <PerformanceContinuityChart />
        </div>
      </div>
    </div>
  );
}
