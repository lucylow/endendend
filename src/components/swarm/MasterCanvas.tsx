import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import * as THREE from "three";
import type { CameraMode } from "@/features/swarm/useSwarmVisualization";
import SwarmScene3D from "@/components/swarm/SwarmScene";
import VictimPrioritySwarmScene from "@/lib/scenarios/victim-priority/VictimPrioritySwarmScene";
import MultiSwarmHandoffScene from "@/scenarios/multi-swarm-handoff/MultiSwarmHandoffScene";

export interface MasterCanvasProps {
  cameraMode: CameraMode;
  tunnelMode: boolean;
  showTrails: boolean;
  showConnections: boolean;
  connectionMode: "relay-chain" | "proximity";
  agentScale: number;
  animate: boolean;
  /** r3f stats overlay (dev / demo). */
  showPerformanceOverlay?: boolean;
  /** Dedicated 3D narratives (stake-weighted rescue, dual-swarm handoff). */
  scenarioSlug?: string;
}

/**
 * Production-oriented canvas preset: ACES tone mapping, shadows, optional stats.
 */
export default function MasterCanvas({
  cameraMode,
  tunnelMode,
  showTrails,
  showConnections,
  connectionMode,
  agentScale,
  animate,
  showPerformanceOverlay = false,
  scenarioSlug,
}: MasterCanvasProps) {
  const customScene =
    scenarioSlug === "victim-priority" ? (
      <VictimPrioritySwarmScene />
    ) : scenarioSlug === "multi-swarm-handoff" ? (
      <MultiSwarmHandoffScene />
    ) : null;

  return (
    <Canvas
      camera={{ position: [0, 20, 50], fov: scenarioSlug === "multi-swarm-handoff" ? 62 : 52 }}
      dpr={[1, 2]}
      shadows
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        alpha: false,
      }}
      onPointerDown={(e) => e.preventDefault()}
    >
      <Suspense fallback={null}>
        {customScene ?? (
          <SwarmScene3D
            cameraMode={cameraMode}
            tunnelMode={tunnelMode}
            showTrails={showTrails}
            showConnections={showConnections}
            connectionMode={connectionMode}
            agentScale={agentScale}
            compact={false}
            animate={animate}
          />
        )}
        {showPerformanceOverlay ? <Stats className="!top-auto !bottom-2 !left-2" /> : null}
      </Suspense>
    </Canvas>
  );
}
