import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { useArenaObstacleStore, type ArenaRacer, FINISH_X } from "@/store/arenaObstacleStore";
import { SwarmPathfindingEngine } from "./SwarmPathfindingEngine";

const TARGET = new THREE.Vector3(FINISH_X, 0, 0);
const TRAIL_MAX = 64;
const SPEED = 11;

function RaceTrails({ racers }: { racers: ArenaRacer[] }) {
  return (
    <group>
      {racers.map((r) => {
        if (r.trail.length < 2) return null;
        const points = r.trail.map((p) => new THREE.Vector3(p.x, 0.35, p.z));
        return (
          <Line
            key={r.id}
            points={points}
            color="#fbbf24"
            lineWidth={1.2}
            transparent
            opacity={0.32}
            dashed={false}
          />
        );
      })}
    </group>
  );
}

export default function ArenaSwarm() {
  const pathfinding = useRef(new SwarmPathfindingEngine()).current;
  const racersRef = useRef<ArenaRacer[]>([]);

  const raceStarted = useArenaObstacleStore((s) => s.raceStarted);
  const raceComplete = useArenaObstacleStore((s) => s.raceComplete);
  const obstacles = useArenaObstacleStore((s) => s.obstacles);
  const storeRacers = useArenaObstacleStore((s) => s.racers);
  const advanceFrame = useArenaObstacleStore((s) => s.advanceFrame);

  useEffect(() => {
    if (raceStarted) {
      racersRef.current = useArenaObstacleStore.getState().racers.map((r) => ({
        ...r,
        trail: [],
        velocity: { x: 0, z: 0 },
      }));
    }
  }, [raceStarted]);

  useEffect(() => {
    if (!raceStarted && !raceComplete) {
      racersRef.current = [];
    }
  }, [raceStarted, raceComplete, storeRacers]);

  useFrame((_, dt) => {
    const { raceStarted: running, raceComplete: done } = useArenaObstacleStore.getState();
    if (!running || done) return;
    const racers = racersRef.current;
    if (racers.length === 0) return;

    const agents = racers.map((r) => ({
      id: r.id,
      position: r.position,
      velocity: r.velocity,
    }));

    const next = racers.map((r) => {
      if (r.position.x >= FINISH_X) return r;
      const pathVec = pathfinding.getOptimalPath(
        { id: r.id, position: r.position, velocity: r.velocity },
        agents,
        TARGET,
        obstacles,
      );
      const vx = pathVec.x * SPEED;
      const vz = pathVec.z * SPEED;
      const nx = THREE.MathUtils.clamp(r.position.x + vx * dt, -48, 48);
      const nz = THREE.MathUtils.clamp(r.position.z + vz * dt, -48, 48);
      const trail = [...r.trail, { x: r.position.x, z: r.position.z }];
      const t = trail.length > TRAIL_MAX ? trail.slice(-TRAIL_MAX) : trail;
      return {
        ...r,
        position: { x: nx, z: nz },
        velocity: { x: vx, z: vz },
        trail: t,
      };
    });

    racersRef.current = next;
    advanceFrame(dt, next);
  });

  const displayRacers = raceComplete ? storeRacers : raceStarted ? racersRef.current : storeRacers;

  return (
    <group>
      {displayRacers.map((r) => (
        <mesh key={r.id} position={[r.position.x, 1.35, r.position.z]} castShadow>
          <dodecahedronGeometry args={[0.95 + r.rank * 0.04, 0]} />
          <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.45} metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
      <RaceTrails racers={displayRacers} />
    </group>
  );
}
