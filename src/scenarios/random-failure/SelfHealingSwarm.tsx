import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { FailureInjectionEngine } from "./FailureInjectionEngine";
import { useRandomFailureStore } from "./randomFailureStore";
import FailureVisualizer from "./FailureVisualizer";

export default function SelfHealingSwarm() {
  const engine = useRef(new FailureInjectionEngine()).current;
  const uptimeAcc = useRef(0);

  useFrame((state) => {
    const store = useRandomFailureStore.getState();
    if (!store.simRunning) return;

    const scale = store.failureTimeScale;
    const time = state.clock.elapsedTime * scale;
    const dt = state.clock.getDelta() * scale;

    let agents = store.agents.map((a) => ({
      ...a,
      position: { ...a.position },
    }));

    const victim = engine.injectRandomFailure(agents, time);
    if (victim) {
      store.pushFailure({ at: time, agentId: victim.id, name: victim.name });
    }

    agents = engine.rebalanceRoles(agents);

    const aliveSorted = agents.filter((a) => a.alive).sort((a, b) => a.id.localeCompare(b.id));

    for (const agent of agents) {
      if (!agent.alive) continue;

      const missionProgress = Math.min(1, Math.max(0, (agent.position.z + 42) / 92));
      agent.position.z += 2.8 * (1 - missionProgress * 0.35) * dt * scale;

      const formationOffset = aliveSorted.findIndex((x) => x.id === agent.id);
      if (formationOffset >= 0) {
        agent.position.x = Math.sin(formationOffset * 0.8 + time * 0.2) * 8;
      }
    }

    store.setAgents(agents);

    if (aliveSorted.length > 0) {
      const avgZ = aliveSorted.reduce((s, a) => s + a.position.z, 0) / aliveSorted.length;
      const prog = Math.min(100, Math.max(0, ((avgZ + 42) / 92) * 100));
      store.setMissionProgress(prog);
    }

    uptimeAcc.current += dt * scale;
    if (uptimeAcc.current > 2) {
      uptimeAcc.current = 0;
      const u = useRandomFailureStore.getState().performanceUptime;
      useRandomFailureStore.getState().appendUptimeSample(u);
    }
  });

  const agents = useRandomFailureStore((s) => s.agents);

  return (
    <group>
      {agents
        .filter((a) => a.alive)
        .map((agent) => (
          <mesh key={agent.id} position={[agent.position.x, agent.position.y, agent.position.z]} castShadow>
            <dodecahedronGeometry args={[agent.role === "leader" ? 1.05 : 0.85, 0]} />
            <meshStandardMaterial
              color={agent.role === "leader" ? "#fbbf24" : agent.role === "relay" ? "#3b82f6" : "#10b981"}
              emissive={agent.role === "leader" ? "#b45309" : "#1e3a8a"}
              emissiveIntensity={0.65}
              metalness={0.85}
              roughness={0.3}
            />
          </mesh>
        ))}
      <FailureVisualizer agents={agents} />
    </group>
  );
}
