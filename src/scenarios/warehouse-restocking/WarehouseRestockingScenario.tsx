import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import WarehouseEnvironment from "./WarehouseEnvironment";
import RestockingSwarm from "./RestockingSwarm";
import PerformanceMetrics, { LiveRestockStats, ShelfMovementTracker } from "./PerformanceMetrics";
import RestockControls from "./RestockControls";
import RestockSuccessAnimation from "./RestockSuccessAnimation";
import { useWarehouseRestockStore } from "@/store/warehouseRestockStore";

type Props = {
  embedded?: boolean;
};

export default function WarehouseRestockingScenario({ embedded = false }: Props) {
  const speedupFactor = useWarehouseRestockStore((s) => s.speedupFactor);

  const shell = embedded
    ? "flex min-h-[56vh] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-orange-950/25 via-zinc-950 to-amber-950/20"
    : "flex h-screen min-h-[560px] flex-col bg-gradient-to-br from-orange-950/20 via-zinc-900 to-amber-950/20";

  return (
    <div className={shell}>
      <div className="border-b border-zinc-800/60 bg-gradient-to-r from-zinc-950/98 via-orange-900/30 to-zinc-900/90 px-4 py-6 shadow-2xl backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-2xl font-black tracking-tight text-transparent drop-shadow-2xl sm:text-3xl">
              Dynamic restocking
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 sm:text-sm">
              <span>Moving shelves · live inventory · continuous path renegotiation</span>
              <Badge className="border-amber-400/40 bg-emerald-600/90 font-bold text-white">{speedupFactor.toFixed(1)}× faster</Badge>
            </div>
          </div>
          <RestockControls />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-4">
        <div className={`relative min-h-[320px] lg:col-span-3 ${embedded ? "min-h-[40vh]" : ""}`}>
          <Canvas
            camera={{ position: [0, 26, 52], fov: 58 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            shadows
            dpr={[1, 2]}
            className="h-full w-full"
          >
            <Suspense fallback={null}>
              <WarehouseEnvironment />
              <RestockingSwarm />
              <RestockSuccessAnimation />
            </Suspense>
          </Canvas>
        </div>

        <aside className="flex flex-col gap-6 overflow-y-auto border-t border-zinc-800/50 bg-zinc-950/95 p-6 shadow-inner backdrop-blur-3xl lg:border-l lg:border-t-0">
          <PerformanceMetrics />
          <LiveRestockStats />
          <ShelfMovementTracker />
        </aside>
      </div>
    </div>
  );
}
