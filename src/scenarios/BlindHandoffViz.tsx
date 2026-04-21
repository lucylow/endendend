import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { defaultAerialView, useSwarmStore } from "@/stores/swarmStore";
import type { RoverState } from "@/stores/swarmStore";

function GroundRover({ rover, highlight }: { rover: RoverState; highlight: boolean }) {
  return (
    <mesh position={rover.position} castShadow>
      <boxGeometry args={[1.1, 0.55, 0.9]} />
      <meshStandardMaterial
        color={highlight ? "#ffd54f" : "#4caf50"}
        emissive={highlight ? "#553300" : "#002200"}
        emissiveIntensity={highlight ? 0.35 : 0.08}
        metalness={0.15}
        roughness={0.55}
      />
    </mesh>
  );
}

function Scene() {
  const aerial = useSwarmStore((s) => s.aerial);
  const ground = useSwarmStore((s) => s.groundRovers);
  const auction = useSwarmStore((s) => s.auction);
  const a = aerial ?? defaultAerialView;
  const victim = a.victim_detected?.coords ?? null;
  const winnerId = auction.winner;

  const rescueLine = useMemo(() => {
    if (!victim || !winnerId) return null;
    const w = ground.find((r) => r.id === winnerId);
    if (!w) return null;
    return [new THREE.Vector3(...w.position), new THREE.Vector3(...victim)] as [
      THREE.Vector3,
      THREE.Vector3,
    ];
  }, [ground, victim, winnerId]);

  const sweepLine = useMemo(() => {
    if (!victim) return null;
    return [new THREE.Vector3(...a.position), new THREE.Vector3(...victim)] as [
      THREE.Vector3,
      THREE.Vector3,
    ];
  }, [a.position, victim]);

  return (
    <>
      <color attach="background" args={["#070b12"]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[30, 80, 20]} intensity={1.05} castShadow />
      <hemisphereLight args={["#87a7ff", "#1a1a12", 0.35]} />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.02} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color="#2a2a32" roughness={0.92} metalness={0.04} />
      </mesh>

      <mesh position={a.position} castShadow>
        <coneGeometry args={[0.9, 2.2, 8]} />
        <meshStandardMaterial color="#42a5f5" metalness={0.25} roughness={0.35} />
      </mesh>

      {victim ? (
        <mesh position={victim}>
          <sphereGeometry args={[0.75, 24, 24]} />
          <meshStandardMaterial color="#ff7043" emissive="#441100" emissiveIntensity={0.4} />
        </mesh>
      ) : null}

      {ground.map((r) => (
        <GroundRover key={r.id} rover={r} highlight={r.id === winnerId} />
      ))}

      {sweepLine ? (
        <Line points={sweepLine} color="#90caf9" lineWidth={2} dashed dashSize={0.4} gapSize={0.25} />
      ) : null}
      {rescueLine ? (
        <Line points={rescueLine} color="#fff176" lineWidth={2.5} />
      ) : null}
    </>
  );
}

export default function BlindHandoffViz() {
  const aerial = useSwarmStore((s) => s.aerial);
  const ground = useSwarmStore((s) => s.groundRovers);
  const auction = useSwarmStore((s) => s.auction);
  const rescues = useSwarmStore((s) => s.rescues_completed);
  const a = aerial ?? defaultAerialView;

  const bidRows = Object.entries(auction.bids);

  return (
    <div className="relative h-full min-h-0 w-full bg-gradient-to-br from-slate-950 via-background to-slate-900">
      <Canvas
        className="h-full w-full"
        shadows
        camera={{ position: [48, 36, 48], fov: 52 }}
        dpr={[1, 2]}
      >
        <Scene />
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-24 max-w-md rounded-lg border border-border/60 bg-black/55 p-3 font-mono text-xs text-white backdrop-blur">
        <div className="text-[11px] text-slate-300">Aerial battery</div>
        <div className="text-lg font-semibold">{a.battery.toFixed(0)}%</div>
        <div className="mt-2 text-[11px] text-slate-300">Auction</div>
        <div>
          {auction.active ? "bidding…" : "idle"}{" "}
          {auction.winner ? <span className="text-amber-300">winner {auction.winner}</span> : null}
        </div>
        {bidRows.length ? (
          <ul className="mt-2 space-y-1 text-[11px]">
            {bidRows.map(([id, b]) => (
              <li key={id}>
                {id}: score {b.score.toFixed(2)} @ {b.distance.toFixed(1)}m
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-2 text-muted-foreground">No bids yet</div>
        )}
        <div className="mt-2 text-[11px] text-slate-300">Rescues completed: {rescues}</div>
        <div className="mt-1 text-[11px] text-slate-400">Ground nodes: {ground.length}</div>
      </div>
    </div>
  );
}
