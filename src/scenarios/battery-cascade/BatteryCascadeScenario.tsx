import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import TunnelRelayEnvironment from "./TunnelRelayEnvironment";
import BatteryCascadeSwarm from "./BatteryCascadeSwarm";
import MissionDurationMetrics from "./MissionDurationMetrics";
import CascadeControls from "./CascadeControls";
import BatteryStatusPanel from "./BatteryStatusPanel";
import PromotionHistory from "./PromotionHistory";
import { useBatteryCascadeStore } from "./batteryCascadeStore";

type Props = {
  /** When true, fits inside SAR demo canvas area instead of full viewport height. */
  embedded?: boolean;
};

export default function BatteryCascadeScenario({ embedded = false }: Props) {
  const missionExtension = useBatteryCascadeStore((s) => s.scenarioStats.missionExtension);
  const session = useBatteryCascadeStore((s) => s.session);

  const shell = embedded ? "flex flex-col rounded-2xl overflow-hidden border border-zinc-800 bg-gradient-to-br from-zinc-900 via-red-950/20 to-black min-h-[56vh]" : "flex flex-col h-screen bg-gradient-to-br from-zinc-900 via-red-950/20 to-black";

  return (
    <div className={shell}>
      <div className="flex flex-col gap-4 border-b border-zinc-800/70 bg-gradient-to-r from-zinc-950/95 to-red-900/50 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-6 lg:p-8">
        <div className="space-y-2 min-w-0">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent drop-shadow-lg">
            Battery cascade failure recovery
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-zinc-400">
            <span>Lead ~15% → relays ~25% → standby auto-promote → mission +42% duration</span>
            <Badge variant="destructive" className="font-mono animate-pulse shrink-0">
              {missionExtension > 0 ? `${missionExtension.toFixed(0)}% longer` : "Live"}
            </Badge>
          </div>
        </div>
        <CascadeControls />
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-4">
        <div className={`relative min-h-[320px] flex-1 lg:col-span-3 ${embedded ? "min-h-[40vh]" : ""}`}>
          <Canvas
            camera={{ position: [0, 14, 32], fov: 72 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            shadows
            dpr={[1, 2]}
          >
            <Suspense fallback={null}>
              <TunnelRelayEnvironment />
              <BatteryCascadeSwarm key={session} />
            </Suspense>
          </Canvas>
        </div>

        <div className="border-t border-zinc-800/50 lg:border-l lg:border-t-0 space-y-6 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-zinc-950/90 backdrop-blur-2xl">
          <BatteryStatusPanel />
          <MissionDurationMetrics />
          <PromotionHistory />
        </div>
      </div>
    </div>
  );
}
