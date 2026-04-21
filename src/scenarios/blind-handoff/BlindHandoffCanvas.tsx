import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { defaultAerialView, useSwarmStore } from "@/stores/swarmStore";
import type { RoverState } from "@/stores/swarmStore";
import { Aerial3D } from "./Aerial3D";
import { AerialSweepHint } from "./AerialSweepHint";
import { GroundRover3D } from "./GroundRover3D";
import { HandoffBeam } from "./HandoffBeam";
import { SidePanel } from "./SidePanel";
import { TerrainField } from "./TerrainField";
import type { HandoffWorldJson } from "./types";
import { VictimMarkers } from "./VictimMarkers";

function RescueLine({
  rover,
  victim,
}: {
  rover: RoverState | undefined;
  victim: [number, number, number] | null;
}) {
  const line = useMemo(() => {
    if (!victim || !rover) return null;
    return [new THREE.Vector3(...rover.position), new THREE.Vector3(...victim)] as [
      THREE.Vector3,
      THREE.Vector3,
    ];
  }, [rover, victim]);
  if (!line) return null;
  return <Line points={line} color="#fff176" lineWidth={2.5} />;
}

function Scene({ victims }: { victims: HandoffWorldJson["victims"] }) {
  const aerial = useSwarmStore((s) => s.aerial);
  const ground = useSwarmStore((s) => s.groundRovers);
  const auction = useSwarmStore((s) => s.auction);
  const a = aerial ?? defaultAerialView;
  const pos = a.position;
  const victim = a.victim_detected?.coords ?? null;
  const winnerId = auction.winner;
  const winner = ground.find((r) => r.id === winnerId);

  const bounds = useMemo(
    () => ({
      xmin: -100,
      xmax: 100,
      zmin: -100,
      zmax: 100,
    }),
    [],
  );

  const beamActive = Boolean(winnerId && victim && auction.active === false && winner);

  return (
    <>
      <color attach="background" args={["#070b12"]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[30, 80, 20]} intensity={1.05} castShadow />
      <hemisphereLight args={["#87a7ff", "#1a1a12", 0.35]} />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.02} />

      <TerrainField bounds={bounds} />
      <VictimMarkers victims={victims} activeCoords={victim} />

      <Aerial3D position={pos} />
      {ground.map((r) => (
        <GroundRover3D key={r.id} rover={r} highlight={r.id === winnerId} />
      ))}

      <AerialSweepHint aerial={pos} victim={victim} />
      <RescueLine rover={winner} victim={victim} />
      {beamActive && winner && victim ? (
        <HandoffBeam from={pos} to={winner.position as [number, number, number]} visible />
      ) : null}
    </>
  );
}

export function BlindHandoffCanvas({ world }: { world: HandoffWorldJson | null }) {
  const aerial = useSwarmStore((s) => s.aerial);
  const ground = useSwarmStore((s) => s.groundRovers);
  const auction = useSwarmStore((s) => s.auction);
  const rescues = useSwarmStore((s) => s.rescues_completed);
  const a = aerial ?? defaultAerialView;
  const victims = world?.victims ?? [];

  return (
    <div className="relative h-full min-h-0 w-full bg-gradient-to-br from-slate-950 via-background to-slate-900">
      <Canvas
        className="h-full w-full"
        shadows
        camera={{ position: [48, 36, 48], fov: 52 }}
        dpr={[1, 2]}
      >
        <Scene victims={victims} />
      </Canvas>
      <SidePanel battery={a.battery} auction={auction} rescues={rescues} groundCount={ground.length} />
    </div>
  );
}
