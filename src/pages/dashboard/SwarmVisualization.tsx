import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSwarmStore } from "@/store/swarmStore";
import { useSwarmVisualization, type CameraMode } from "@/features/swarm/useSwarmVisualization";
import { useSwarmRealtime } from "@/features/websocket/useSwarmRealtime";
import SwarmScene3D from "@/components/swarm/SwarmScene";
import TelemetryOverlay from "@/components/swarm/TelemetryOverlay";
import AgentList from "@/components/swarm/AgentList";
import { WebSocketStatus } from "@/pages/dashboard/visualization/WebSocketStatus";
import { RealtimeAgentList } from "@/pages/dashboard/visualization/RealtimeAgentList";
import { CriticalAlertHUD } from "@/components/health/CriticalAlertHUD";
import { HealthOverlay } from "@/pages/dashboard/visualization/HealthOverlay";
import { useFleetHealthAlerts, useRobotHealthSync } from "@/features/health/useRobotHealth";
import { cn } from "@/lib/utils";

function StatusBar() {
  const { swarm, agentCount, coordinationLatency, avgBattery } = useSwarmVisualization();

  const pulse =
    swarm.status === "coordinating" || swarm.status === "exploring"
      ? "bg-emerald-400 animate-pulse"
      : swarm.status === "emergency"
        ? "bg-orange-500"
        : "bg-amber-400";

  return (
    <motion.div
      className="absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-2xl border border-zinc-800/90 bg-zinc-950/95 px-6 py-3 shadow-2xl backdrop-blur-xl sm:px-8 sm:py-4"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <div className={cn("h-2.5 w-2.5 rounded-full", pulse)} />
          <span className="font-medium tracking-wide text-zinc-200">{swarm.status.toUpperCase()}</span>
        </div>
        <div className="text-zinc-400">
          Agents: <span className="font-mono text-emerald-400">{agentCount}</span>
        </div>
        <div className="text-zinc-400">
          Latency: <span className="font-mono text-cyan-400">{coordinationLatency}ms</span>
        </div>
        <div className="text-zinc-400">
          Battery avg: <span className="font-mono text-zinc-200">{avgBattery.toFixed(0)}%</span>
        </div>
      </div>
    </motion.div>
  );
}

function VizControlsPanel({
  cameraMode,
  setCameraMode,
  showTrails,
  setShowTrails,
  showConnections,
  setShowConnections,
  tunnelMode,
  setTunnelMode,
  agentScale,
  setAgentScale,
  simSpeed,
  setSimSpeed,
  connectionMode,
  setConnectionMode,
}: {
  cameraMode: CameraMode;
  setCameraMode: (m: CameraMode) => void;
  showTrails: boolean;
  setShowTrails: (v: boolean) => void;
  showConnections: boolean;
  setShowConnections: (v: boolean) => void;
  tunnelMode: boolean;
  setTunnelMode: (v: boolean) => void;
  agentScale: number;
  setAgentScale: (n: number) => void;
  simSpeed: number;
  setSimSpeed: (n: number) => void;
  connectionMode: "relay-chain" | "proximity";
  setConnectionMode: (m: "relay-chain" | "proximity") => void;
}) {
  return (
    <motion.div
      className="pointer-events-auto absolute bottom-4 left-4 z-40 w-[min(100%,17rem)] rounded-2xl border border-zinc-800/90 bg-zinc-950/92 p-4 shadow-xl backdrop-blur-xl sm:bottom-6 sm:left-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.35 }}
    >
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Swarm viz</p>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] text-zinc-400">Camera</Label>
          <Select value={cameraMode} onValueChange={(v) => setCameraMode(v as CameraMode)}>
            <SelectTrigger className="h-8 border-zinc-700 bg-zinc-900/80 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="orbit">Orbit</SelectItem>
              <SelectItem value="top-down">Top-down</SelectItem>
              <SelectItem value="follow-leader">Follow leader</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] text-zinc-400">Links</Label>
          <Select value={connectionMode} onValueChange={(v) => setConnectionMode(v as "relay-chain" | "proximity")}>
            <SelectTrigger className="h-8 border-zinc-700 bg-zinc-900/80 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relay-chain">Relay chain</SelectItem>
              <SelectItem value="proximity">Proximity</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="viz-trails" className="text-[11px] text-zinc-400">
            Trails
          </Label>
          <Switch id="viz-trails" checked={showTrails} onCheckedChange={setShowTrails} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="viz-conn" className="text-[11px] text-zinc-400">
            Connections
          </Label>
          <Switch id="viz-conn" checked={showConnections} onCheckedChange={setShowConnections} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="viz-tunnel" className="text-[11px] text-zinc-400">
            Tunnel
          </Label>
          <Switch id="viz-tunnel" checked={tunnelMode} onCheckedChange={setTunnelMode} />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <Label>Agent scale</Label>
            <span className="font-mono text-zinc-300">{agentScale.toFixed(2)}</span>
          </div>
          <Slider
            value={[agentScale]}
            min={0.5}
            max={2}
            step={0.05}
            onValueChange={(v) => setAgentScale(v[0])}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <Label>Sim speed</Label>
            <span className="font-mono text-zinc-300">{simSpeed.toFixed(1)}×</span>
          </div>
          <Slider
            value={[simSpeed]}
            min={0.2}
            max={5}
            step={0.1}
            onValueChange={(v) => setSimSpeed(v[0])}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function SwarmVisualizationPage({ layout = "dashboard" }: { layout?: "dashboard" | "mission" }) {
  const [cameraMode, setCameraMode] = useState<CameraMode>("orbit");
  const [showTrails, setShowTrails] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [tunnelMode, setTunnelMode] = useState(true);
  const [agentScale, setAgentScale] = useState(1);
  const [connectionMode, setConnectionMode] = useState<"relay-chain" | "proximity">("relay-chain");

  const speed = useSwarmStore((s) => s.speed);
  const setSpeed = useSwarmStore((s) => s.setSpeed);
  const isRunning = useSwarmStore((s) => s.isRunning);
  const realtimeTelemetryActive = useSwarmStore((s) => s.realtimeTelemetryActive);

  const healthAlerts = useFleetHealthAlerts();
  useRobotHealthSync();
  useSwarmRealtime();

  const shell =
    layout === "mission"
      ? "relative min-h-[calc(100dvh-7rem)] w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black md:min-h-[calc(100dvh-4rem)]"
      : "relative -mx-5 -mt-2 min-h-[calc(100dvh-5rem)] w-[calc(100%+2.5rem)] overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-zinc-900 via-zinc-950 to-black sm:-mx-8 sm:w-[calc(100%+4rem)]";

  return (
    <div className={shell}>
      <div className="absolute inset-0 z-10">
        <Canvas
          camera={{ position: [0, 16, 32], fov: 58 }}
          dpr={[1, 2]}
          shadows
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            alpha: false,
          }}
          onPointerDown={(e) => e.preventDefault()}
        >
          <Suspense fallback={null}>
            <SwarmScene3D
              cameraMode={cameraMode}
              tunnelMode={tunnelMode}
              showTrails={showTrails}
              showConnections={showConnections}
              connectionMode={connectionMode}
              agentScale={agentScale}
              compact={false}
              animate={isRunning && !realtimeTelemetryActive}
            />
          </Suspense>
        </Canvas>
      </div>

      <VizControlsPanel
        cameraMode={cameraMode}
        setCameraMode={setCameraMode}
        showTrails={showTrails}
        setShowTrails={setShowTrails}
        showConnections={showConnections}
        setShowConnections={setShowConnections}
        tunnelMode={tunnelMode}
        setTunnelMode={setTunnelMode}
        agentScale={agentScale}
        setAgentScale={setAgentScale}
        simSpeed={speed}
        setSimSpeed={setSpeed}
        connectionMode={connectionMode}
        setConnectionMode={setConnectionMode}
      />

      <WebSocketStatus />
      <TelemetryOverlay />
      <HealthOverlay />
      <CriticalAlertHUD alerts={healthAlerts} />
      <AgentList />
      <div className="pointer-events-none absolute bottom-24 right-4 z-40 w-[min(100%,20rem)] sm:right-6">
        <RealtimeAgentList />
      </div>
      <StatusBar />

      <p className="pointer-events-none absolute left-4 top-14 z-30 max-w-xs text-[10px] leading-relaxed text-zinc-500 sm:left-6 sm:top-16">
        Tashi Swarm Control — 3D view. Use orbit when camera is in orbit mode; top-down and follow override the
        controller until you switch back.
      </p>
    </div>
  );
}
