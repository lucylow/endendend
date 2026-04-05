import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSwarmStore } from "@/store/swarmStore";
import { useScenarioVizStore } from "@/store/scenarioVizStore";
import { SwarmHandoverEngine } from "./SwarmHandoverEngine";

/**
 * Heavy Swarm B — standby ring, then stake-aware approach + lift formation after handoff.
 */
export default function SwarmBHeavyLift() {
  const engine = useRef(new SwarmHandoverEngine()).current;
  const seeded = useRef(false);

  const handoffActive = useScenarioVizStore((s) => s.handoffActive);

  useEffect(() => {
    if (handoffActive && !seeded.current) {
      engine.initiateHandover(new THREE.Vector3(0, 0, 0), [0.4, 0.5, 0.6, 0.55]);
      seeded.current = true;
    }
    if (!handoffActive) seeded.current = false;
  }, [handoffActive, engine]);

  useFrame(() => {
    const { isRunning, speed } = useSwarmStore.getState();
    const viz = useScenarioVizStore.getState();
    if (!isRunning || viz.agentsB.length === 0) return;
    const dt = 0.016 * speed;

    const next = viz.agentsB.map((a) => ({
      ...a,
      position: { ...a.position },
      velocity: { ...a.velocity },
    }));

    if (viz.handoffActive) {
      const approach = engine.getHandoverVector().multiplyScalar(0.09 * dt * 60);
      next.forEach((agent, i) => {
        agent.velocity.x = approach.x;
        agent.velocity.z = approach.z;
        agent.position.x += agent.velocity.x;
        agent.position.z += agent.velocity.z;
        const lift = engine.getLiftPosition(agent.id, i, next.length);
        agent.position.x += (lift.x - agent.position.x) * 0.06 * dt * 60;
        agent.position.z += (lift.z - agent.position.z) * 0.06 * dt * 60;
        agent.position.y += (lift.y - agent.position.y) * 0.05 * dt * 60;
      });
    } else {
      next.forEach((agent, i) => {
        agent.position.x = 35 + Math.cos(i * 1.2) * 7;
        agent.position.y = 1.5;
        agent.position.z = -25 + Math.sin(i * 1.2) * 7;
      });
    }

    viz.setAgentsB(next);
  });

  const agentsB = useScenarioVizStore((s) => s.agentsB);

  return (
    <group>
      {agentsB.map((agent) => (
        <mesh key={agent.id} castShadow position={[agent.position.x, agent.position.y, agent.position.z]} scale={1.15}>
          <boxGeometry args={[1.1, 1.65, 1.25]} />
          <meshStandardMaterial color="#3b82f6" emissive="#2563eb" emissiveIntensity={0.5} metalness={0.88} />
        </mesh>
      ))}
    </group>
  );
}
