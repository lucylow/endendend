import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { OrbitControls } from "@react-three/drei";
import { Badge } from "@/components/ui/badge";
import ThermalEnvironment from "./ThermalEnvironment";
import CoolingFormationSwarm from "./CoolingFormationSwarm";
import TemperatureMetrics from "./TemperatureMetrics";
import ThermalControls from "./ThermalControls";
import { useThermalRebalanceStore, TARGET_RECOVERY_S } from "./thermalRebalanceStore";

export default function ThermalRebalanceScenario() {
  const coolingSuccess = useThermalRebalanceStore((s) => s.coolingSuccess);
  const emergencyEver = useThermalRebalanceStore((s) => s.emergencyEver);

  return (
    <div className="flex h-[calc(100vh-0px)] min-h-[560px] flex-col bg-gradient-to-br from-emerald-950/20 via-zinc-950 to-cyan-950/15">
      <div className="border-b border-zinc-800/60 bg-gradient-to-r from-zinc-950/98 via-emerald-950/25 to-zinc-900/90 px-4 py-6 shadow-xl backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-300 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
              Cooling formation swarm
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
              <span>Shielding behavior · heat source · consensus separation · cooler-agent shielding</span>
              {coolingSuccess ? (
                <Badge className="border-emerald-400/50 bg-emerald-600/90 font-bold text-white">Recovered</Badge>
              ) : emergencyEver ? (
                <Badge variant="destructive" className="animate-pulse font-mono">
                  Thermal emergency
                </Badge>
              ) : (
                <Badge variant="secondary">Patrol</Badge>
              )}
            </div>
          </div>
          <ThermalControls />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-4">
        <div className="relative min-h-[320px] lg:col-span-3">
          <Canvas
            camera={{ position: [0, 28, 36], fov: 48 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            shadows
            className="h-full w-full"
          >
            <Suspense fallback={null}>
              <ThermalEnvironment />
              <CoolingFormationSwarm />
              <OrbitControls enableDamping maxPolarAngle={Math.PI / 2.05} />
            </Suspense>
          </Canvas>
        </div>

        <aside className="flex flex-col gap-6 overflow-y-auto border-t border-zinc-800/50 bg-zinc-950/90 p-6 shadow-inner backdrop-blur-xl lg:border-l lg:border-t-0">
          <TemperatureMetrics />
          <p className="text-xs leading-relaxed text-zinc-500">
            Tight cluster heats up near the exhaust plume; above 80°C agents vote separation while cooler units bias
            into a shield line. Watch gauges and recovery time vs the {TARGET_RECOVERY_S}s warehouse SLA.
          </p>
        </aside>
      </div>
    </div>
  );
}
