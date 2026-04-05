import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EvasionManeuverEngine, type EvasionSimAgent } from "./EvasionManeuverEngine";
import { usePredatorEvasionStore } from "./predatorEvasionStore";

function distXZ(a: { x: number; z: number }, b: { x: number; z: number }) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function minPairSeparation(agents: EvasionSimAgent[]): number {
  let m = Infinity;
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      m = Math.min(m, distXZ(agents[i]!.position, agents[j]!.position));
    }
  }
  return m === Infinity ? 99 : m;
}

export default function EvasionSwarm() {
  const engine = useRef(new EvasionManeuverEngine()).current;

  useFrame((state) => {
    const store = usePredatorEvasionStore.getState();
    if (!store.simRunning) return;

    const scale = store.failureTimeScale;
    const t = state.clock.elapsedTime * scale;
    const dt = state.clock.getDelta() * scale;

    const forkX = -32 + t * 3.2;
    const forkZ = 2 + Math.sin(t * 0.15) * 1.5;
    store.patchForklift({ x: forkX, z: forkZ });

    const threat = new THREE.Vector3(forkX, 0, forkZ);

    let agents = store.agents.map((a) => ({
      ...a,
      position: { ...a.position },
    }));

    let minThreat = Infinity;
    for (const a of agents) {
      minThreat = Math.min(minThreat, distXZ(a.position, { x: forkX, z: forkZ }));
    }

    let threatT0 = store.threatT0;
    if (t > 8 * scale && store.threatArmed && threatT0 === null) {
      store.setMetrics({ threatT0: t, threatActive: true });
      threatT0 = t;
    }

    const threatActive = store.threatActive && threatT0 !== null;
    const sinceThreat = threatT0 !== null ? t - threatT0 : 0;

    let narrative = store.narrative;
    let missionDelaySec = store.missionDelaySec;

    if (threatActive && threatT0 !== null) {
      if (sinceThreat < 1 * scale) {
        agents = agents.map((a) => ({ ...a, evasionPhase: "scatter" as const }));
        narrative = "FORKLIFT THREAT DETECTED — instant scatter (orthogonal evasion)";
      } else if (sinceThreat < 4 * scale) {
        agents = agents.map((a) => ({ ...a, evasionPhase: "scatter" as const }));
        narrative = "Instant scatter — orthogonal evasion vectors";
      } else if (sinceThreat < 12 * scale) {
        agents = agents.map((a) => ({ ...a, evasionPhase: "reform" as const }));
        narrative = "Reform behind threat — safe envelope";
      } else {
        agents = agents.map((a) => ({ ...a, evasionPhase: "idle" as const }));
        narrative = "Mission resumes — ~8s delay vs static formation pile-up";
        missionDelaySec = 8;
      }
    } else if (!threatActive) {
      narrative = "Normal formation continuing mission";
      missionDelaySec = 0;
    }

    for (const a of agents) {
      const v = engine.getEvasionVector(a, agents, threat);
      if (v.lengthSq() > 0) {
        a.position.x += v.x * dt * 4;
        a.position.z += v.z * dt * 4;
      } else if (!threatActive || sinceThreat >= 12 * scale) {
        a.position.z += 0.12 * dt * 12;
        a.position.x += Math.sin(t * 0.4 + (a.id.charCodeAt(8) ?? 0)) * 0.02;
      }
    }

    const sep = minPairSeparation(agents);
    const collision = sep < 0.85;
    const n = agents.length;
    store.setAgents(agents);
    store.setMetrics({
      simTime: t,
      threatActive: threatT0 !== null && store.threatActive,
      narrative,
      threatDistanceM: Math.round(minThreat * 10) / 10,
      collisionRiskPct: collision ? Math.min(99, Math.round((0.85 - sep) * 120)) : 0,
      zeroCollisions: !collision,
      agentsSafe: collision ? `${Math.max(0, n - 1)}/${n}` : `${n}/${n}`,
      missionDelaySec,
    });
  });

  const agents = usePredatorEvasionStore((s) => s.agents);

  return (
    <group>
      {agents.map((agent) => (
        <mesh key={agent.id} position={[agent.position.x, agent.position.y, agent.position.z]} castShadow>
          <dodecahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial
            color={agent.evasionPhase === "scatter" ? "#22c55e" : agent.evasionPhase === "reform" ? "#38bdf8" : "#a78bfa"}
            emissive={agent.evasionPhase === "idle" ? "#4c1d95" : "#14532d"}
            emissiveIntensity={0.45}
            metalness={0.65}
            roughness={0.35}
          />
        </mesh>
      ))}
    </group>
  );
}
