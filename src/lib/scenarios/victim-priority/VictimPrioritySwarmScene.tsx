import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useSwarmStore } from "@/store/swarmStore";
import { useScenarioVizStore, type VictimScenarioAgent } from "@/store/scenarioVizStore";
import { StakeVotingEngine } from "./StakeVotingEngine";

const VICTIM: { x: number; z: number } = { x: -12, z: 0 };
const SECTOR = 12;

function sectorForAgent(id: string): { x: number; z: number } {
  const suffix = id.includes("-") ? id.split("-").pop() ?? "A" : id.slice(-1);
  const letter = suffix.charAt(0).toUpperCase();
  const lx = ((letter.charCodeAt(0) % 6) - 2.5) * SECTOR;
  const lz = (((letter.charCodeAt(0) * 3) % 5) - 2) * SECTOR * 0.85;
  return { x: lx, z: lz };
}

function RoleBadge({ agent }: { agent: VictimScenarioAgent }) {
  if (!agent.victimDetected) return null;
  const label =
    agent.rescueRole === "converge" ? "CONVERGE" : agent.rescueRole === "relay" ? "RELAY" : "SEARCH";
  const color =
    agent.rescueRole === "converge" ? "#10b981" : agent.rescueRole === "relay" ? "#3b82f6" : "#f59e0b";
  return (
    <Html position={[agent.position.x, 2.2 + agent.stake * 0.4, agent.position.z]} center distanceFactor={10}>
      <div
        className="rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-tight shadow-lg whitespace-nowrap"
        style={{
          borderColor: `${color}99`,
          background: "rgba(9,9,12,0.82)",
          color,
        }}
      >
        {label}
      </div>
    </Html>
  );
}

function VictoryBurst({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const t = useRef(0);
  const parts = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        seed: i * 0.37,
        c: new THREE.Color().setHSL((i * 0.07) % 1, 0.85, 0.55),
      })),
    [],
  );

  useFrame((_, dt) => {
    if (!active || !group.current) return;
    t.current += dt;
    group.current.children.forEach((ch, i) => {
      const p = parts[i];
      if (!p) return;
      const a = t.current * 2 + p.seed * 10;
      ch.position.set(Math.cos(a) * (2 + p.seed * 4), (t.current % 3) * 2.2 + p.seed, Math.sin(a * 0.9) * (2 + p.seed * 3));
    });
  });

  if (!active) return null;
  return (
    <group position={[VICTIM.x, 4, VICTIM.z]} ref={group}>
      {parts.map((p, i) => (
        <mesh key={i} scale={0.18}>
          <boxGeometry />
          <meshStandardMaterial color={p.c} emissive={p.c} emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

export default function VictimPrioritySwarmScene() {
  const engine = useRef(new StakeVotingEngine()).current;

  const victimAgents = useScenarioVizStore((s) => s.victimAgents);
  const missionComplete = useScenarioVizStore((s) => s.missionComplete);

  useFrame(() => {
    const { isRunning, speed } = useSwarmStore.getState();
    const viz = useScenarioVizStore.getState();
    if (!isRunning || viz.victimAgents.length === 0) return;
    const dt = 0.016 * speed;
    const next = viz.victimAgents.map((a) => ({ ...a, position: { ...a.position } }));

    const roverC = next.find((a) => a.id === "rover-C");
    if (roverC && !roverC.victimDetected) {
      const d = Math.hypot(roverC.position.x - VICTIM.x, roverC.position.z - VICTIM.z);
      if (d < 2.2) {
        next.forEach((a) => {
          a.victimDetected = true;
        });
      }
    }

    next.forEach((agent) => {
      if (!agent.victimDetected) {
        const { x: sectorX, z: sectorZ } = sectorForAgent(agent.id);
        agent.position.x += (sectorX - agent.position.x) * 0.045 * dt * 60;
        agent.position.z += (sectorZ - agent.position.z) * 0.045 * dt * 60;
      } else {
        const priority = engine.calculatePriority(agent, VICTIM);
        const convergenceSpeed = priority * 0.08 * dt * 60;
        agent.position.x += (VICTIM.x - agent.position.x) * convergenceSpeed;
        agent.position.z += (VICTIM.z - agent.position.z) * convergenceSpeed;
        agent.rescueRole = engine.assignRole(agent, next, VICTIM);
      }
    });

    const allKnow = next.every((a) => a.victimDetected);
    if (allKnow) {
      const minD = Math.min(...next.map((a) => Math.hypot(a.position.x - VICTIM.x, a.position.z - VICTIM.z)));
      if (minD < 1.4 && !viz.missionComplete) viz.setMissionComplete(true);
    }

    viz.setVictimAgents(next);
  });

  return (
    <>
      <color attach="background" args={["#060a14"]} />
      <fog attach="fog" args={["#060a14", 18, 90]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[18, 32, 12]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-16, 10, 4]} intensity={0.5} color="#f43f5e" />
      <Stars radius={70} depth={60} count={1800} factor={2.4} fade speed={0.35} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#12151f" metalness={0.2} roughness={0.92} />
      </mesh>

      <group position={[VICTIM.x, 0.2, VICTIM.z]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.35, 0.55, 1.2, 16]} />
          <meshStandardMaterial color="#f43f5e" emissive="#fb7185" emissiveIntensity={0.8} metalness={0.4} />
        </mesh>
        <pointLight intensity={1.8} color="#f43f5e" distance={14} />
      </group>

      {victimAgents.map((agent) => (
        <group key={agent.id}>
          <mesh
            castShadow
            position={[agent.position.x, 0.55 + agent.stake * 0.45, agent.position.z]}
            scale={1 + agent.stake * 0.28}
            rotation={[0, agent.stake * Math.PI * 2, 0]}
          >
            <dodecahedronGeometry args={[1.05, 1]} />
            <meshStandardMaterial
              color="#0ea5e9"
              emissive="#00d4ff"
              emissiveIntensity={0.45}
              metalness={0.88}
              roughness={0.22}
            />
          </mesh>
          <RoleBadge agent={agent} />
        </group>
      ))}

      <VictoryBurst active={missionComplete} />

      <Html position={[VICTIM.x, 6.5, VICTIM.z]} center distanceFactor={14}>
        {missionComplete ? (
          <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/90 px-4 py-2 text-center shadow-2xl backdrop-blur-md">
            <div className="text-sm font-black tracking-wide text-emerald-300">MISSION SUCCESS</div>
            <div className="text-[10px] text-emerald-200/80">Stake-weighted convergence — no central controller</div>
          </div>
        ) : null}
      </Html>

      <OrbitControls
        enableDamping
        dampingFactor={0.055}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.02}
        minDistance={12}
        maxDistance={75}
      />
    </>
  );
}
