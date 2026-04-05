import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { OrbitControls } from "@react-three/drei";
import { Badge } from "@/components/ui/badge";
import ForkedPathEnvironment from "./ForkedPathEnvironment";
import VotingSwarm from "./VotingSwarm";
import VotingMetrics from "./VotingMetrics";
import VotingVisualizer from "./VotingVisualizer";
import StakeControls from "./StakeControls";
import { useStakeVotingStore } from "./stakeVotingStore";

type Props = {
  embedded?: boolean;
};

export default function StakeVotingScenario({ embedded = false }: Props) {
  const optimalChoiceRate = useStakeVotingStore((s) => s.optimalChoiceRate);
  const consensusIsOptimal = useStakeVotingStore((s) => s.consensusIsOptimal);
  const session = useStakeVotingStore((s) => s.session);

  const shell = embedded
    ? "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-purple-950/30 via-zinc-900 to-emerald-950/25 min-h-[56vh]"
    : "flex h-screen flex-col bg-gradient-to-br from-purple-950/30 via-zinc-900 to-emerald-950/25";

  return (
    <div className={shell}>
      <div className="flex flex-col gap-4 border-b border-zinc-800/50 bg-gradient-to-r from-zinc-950/95 via-purple-900/20 to-emerald-900/20 p-4 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-6 lg:p-8">
        <div className="min-w-0 space-y-2">
          <h1 className="bg-gradient-to-r from-purple-400 via-pink-400 to-emerald-400 bg-clip-text text-2xl font-black tracking-tight text-transparent drop-shadow-lg sm:text-3xl">
            Stake-weighted voting
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 sm:text-sm">
            <span>50/50 preferences · high stake tips consensus · economic weight = swarm IQ</span>
            <Badge variant="secondary" className="font-mono text-[11px] sm:text-sm">
              {optimalChoiceRate.toFixed(0)}% optimal (weighted)
            </Badge>
            <Badge
              variant="outline"
              className={`font-mono text-[10px] ${consensusIsOptimal ? "border-emerald-500/50 text-emerald-400" : "border-red-500/50 text-red-400"}`}
            >
              {consensusIsOptimal ? "Live → B" : "Live → A"}
            </Badge>
          </div>
        </div>
        <StakeControls />
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-4">
        <div className={`relative min-h-[280px] flex-1 lg:col-span-3 ${embedded ? "min-h-[40vh]" : ""}`}>
          <Canvas
            key={session}
            camera={{ position: [0, 22, 48], fov: 72 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            shadows
            dpr={[1, 2]}
            className="h-full w-full"
          >
            <Suspense fallback={null}>
              <ForkedPathEnvironment />
              <VotingSwarm />
              <OrbitControls enableDamping maxPolarAngle={Math.PI / 2.05} />
            </Suspense>
          </Canvas>
        </div>

        <aside className="flex flex-col gap-6 overflow-y-auto border-t border-zinc-800/50 bg-zinc-950/95 p-4 backdrop-blur-xl sm:p-6 lg:border-l lg:border-t-0">
          <VotingMetrics />
          <VotingVisualizer />
        </aside>
      </div>
    </div>
  );
}
