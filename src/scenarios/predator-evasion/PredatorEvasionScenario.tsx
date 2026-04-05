import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import WarehouseEvasionEnvironment from "./WarehouseEvasionEnvironment";
import EvasionSwarm from "./EvasionSwarm";
import EvasionMetrics from "./EvasionMetrics";
import EvasionControls from "./EvasionControls";
import { usePredatorEvasionStore } from "./predatorEvasionStore";

type Props = {
  embedded?: boolean;
};

export default function PredatorEvasionScenario({ embedded = false }: Props) {
  const narrative = usePredatorEvasionStore((s) => s.narrative);
  const session = usePredatorEvasionStore((s) => s.session);

  const shell = embedded
    ? "flex min-h-[56vh] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-emerald-950/20 to-zinc-950"
    : "flex h-screen flex-col bg-gradient-to-br from-zinc-900 via-emerald-950/15 to-zinc-950";

  return (
    <div className={shell}>
      <div className="flex flex-col gap-4 border-b border-zinc-800/60 bg-gradient-to-r from-zinc-950/98 via-zinc-900/80 to-zinc-900/90 p-4 backdrop-blur-xl shadow-xl sm:flex-row sm:items-center sm:justify-between sm:p-6 lg:p-8">
        <div className="min-w-0 space-y-2">
          <h1 className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-2xl font-black text-transparent drop-shadow-2xl sm:text-3xl">
            Evasion maneuver engine
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 sm:text-sm">
            <span>Scatter → reform · orthogonal vectors · &lt;50ms-class prediction narrative</span>
            <Badge className="shrink-0 border-emerald-500/40 bg-emerald-600/80 font-mono text-white">Warehouse safety</Badge>
          </div>
          {embedded && <p className="text-xs text-zinc-500 line-clamp-2">{narrative}</p>}
        </div>
        <EvasionControls />
      </div>

      <div className="grid min-h-0 flex-1 flex-col lg:grid-cols-4">
        <div className={`relative min-h-[320px] flex-1 lg:col-span-3 ${embedded ? "min-h-[40vh]" : ""}`}>
          <Canvas camera={{ position: [0, 18, 38], fov: 72 }} gl={{ antialias: true }} shadows dpr={[1, 2]}>
            <Suspense fallback={null}>
              <WarehouseEvasionEnvironment />
              <EvasionSwarm key={session} />
            </Suspense>
          </Canvas>
        </div>

        <div className="space-y-6 overflow-y-auto border-t border-zinc-800/50 bg-zinc-950/95 p-4 backdrop-blur-3xl sm:p-6 lg:border-l lg:border-t-0 lg:p-8">
          <EvasionMetrics />
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-4 text-xs leading-relaxed text-zinc-400">
            <p className="font-semibold text-zinc-300">Demo timing</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>0:00 — Normal formation</li>
              <li>0:08 — Forklift threat</li>
              <li>0:08–0:12 — Scatter</li>
              <li>0:12–0:20 — Reform behind threat</li>
              <li>0:20+ — Mission resumes (~8s delay vs static)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
