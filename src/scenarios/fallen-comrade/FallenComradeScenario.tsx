import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useSwarmStore } from "@/stores/swarmStore";
import type { RoverState } from "@/stores/swarmStore";
import { FailureOverlay } from "./FailureOverlay";
import { FieldGridLines, SectorGrid } from "./SectorGrid";
import { GlobalMapOverlay } from "./GlobalMapOverlay";
import { RoverMesh } from "./RoverMesh";
import { ReallocAnim } from "./ReallocAnim";
import { useFallenComradeSimulation } from "./useFallenComradeSimulation";

function Scene() {
  const rovers = useSwarmStore((s) => s.rovers);
  const globalMap = useSwarmStore((s) => s.globalMap);
  const reallocated = useSwarmStore((s) => s.reallocated);

  return (
    <>
      <color attach="background" args={["#0a0a0c"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[40, 60, 20]} intensity={1.1} castShadow />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} target={[50, 0, 10]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[50, 0, 50]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#1f3d2a" roughness={0.9} metalness={0.05} />
      </mesh>

      <FieldGridLines />
      <GlobalMapOverlay map={globalMap} />

      {rovers.map((rover: RoverState) => (
        <SectorGrid
          key={`s-${rover.id}`}
          bounds={rover.sector.bounds}
          opacity={reallocated ? 0.22 : 0.5}
          color={rover.state === "dead" ? "#ff6b6b" : "#69f0ae"}
        />
      ))}

      {rovers.map((rover: RoverState) => (
        <RoverMesh
          key={rover.id}
          position={rover.position}
          scale={0.35 + (rover.battery / 100) * 0.85}
          color={rover.state === "dead" ? "#ff4444" : reallocated ? "#7cfc00" : "#4f8cff"}
          pulse={reallocated && rover.state !== "dead"}
        />
      ))}

      <fog attach="fog" args={["#0a0a0c", 80, 260]} />
    </>
  );
}

export function FallenComradeScenario() {
  useFallenComradeSimulation();
  const time = useSwarmStore((s) => s.time);
  const reallocated = useSwarmStore((s) => s.reallocated);
  const globalMap = useSwarmStore((s) => s.globalMap);
  const wsConnected = useSwarmStore((s) => s.wsConnected);

  let liveCells = 0;
  if (globalMap.length > 0) {
    try {
      liveCells = globalMap.reduce((acc, row) => {
        if (!Array.isArray(row)) return acc;
        return acc + row.filter((c) => typeof c === "number" && Number.isFinite(c) && c > 0).length;
      }, 0);
    } catch {
      liveCells = 0;
    }
  }
  const timeLabel = Number.isFinite(time) ? time.toFixed(1) : "0.0";

  return (
    <div className="h-full min-h-0 w-full bg-gradient-to-br from-zinc-950 to-black">
      <Canvas
        className="h-full w-full"
        shadows
        camera={{ position: [85, 55, 85], fov: 50, near: 0.1, far: 500 }}
        dpr={[1, 2]}
      >
        <Scene />
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-24 font-mono text-sm text-white drop-shadow-md">
        <div>T+{timeLabel}s</div>
        <div>Reallocated: {reallocated ? "yes" : "no"}</div>
        <div>Live cells: {liveCells}</div>
        <div className="mt-1 text-[11px] text-zinc-400">
          {wsConnected ? "Live Webots / mock WS" : "Built-in mock engine (60fps)"}
        </div>
      </div>
      <FailureOverlay />
      <ReallocAnim />
    </div>
  );
}
