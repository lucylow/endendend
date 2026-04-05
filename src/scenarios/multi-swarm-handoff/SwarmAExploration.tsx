import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSwarmStore } from "@/store/swarmStore";
import { useScenarioVizStore } from "@/store/scenarioVizStore";

const TARGET = new THREE.Vector3(0, 0, 0);

/**
 * Light Swarm A — advances toward the objective until FoxMQ-style handoff fires.
 */
export default function SwarmAExploration() {
  const handoffOnce = useRef(false);
  const handoffSession = useScenarioVizStore((s) => s.handoffSession);

  useEffect(() => {
    handoffOnce.current = false;
  }, [handoffSession]);

  useFrame(() => {
    const { isRunning, speed } = useSwarmStore.getState();
    const viz = useScenarioVizStore.getState();
    if (!isRunning || viz.handoffActive || viz.agentsA.length === 0) return;

    const dt = 0.016 * speed;
    const next = viz.agentsA.map((a) => ({
      ...a,
      position: { ...a.position },
      velocity: { ...a.velocity },
    }));

    next.forEach((agent) => {
      const pos = new THREE.Vector3(agent.position.x, agent.position.y, agent.position.z);
      const to = TARGET.clone().sub(pos);
      const dist = to.length();
      if (dist > 0.01) {
        to.normalize().multiplyScalar(0.1 * dt * 60);
        agent.position.x += to.x;
        agent.position.z += to.z;
      }

      const d = Math.hypot(agent.position.x - TARGET.x, agent.position.z - TARGET.z);
      if (!handoffOnce.current && d < 8.5) {
        handoffOnce.current = true;
        viz.triggerHandoff();
      }
    });

    viz.setAgentsA(next);
  });

  const agentsA = useScenarioVizStore((s) => s.agentsA);

  return (
    <group>
      {agentsA.map((agent) => (
        <mesh key={agent.id} castShadow position={[agent.position.x, agent.position.y, agent.position.z]}>
          <icosahedronGeometry args={[0.55, 1]} />
          <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.45} metalness={0.75} />
        </mesh>
      ))}
    </group>
  );
}
