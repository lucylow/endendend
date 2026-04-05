import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Instances, Instance } from "@react-three/drei";
import * as THREE from "three";
import { HeatPropagationModel } from "./HeatPropagationModel";
import { ThermalVotingEngine } from "./ThermalVotingEngine";
import { thermalColor, useThermalRebalanceStore, TARGET_RECOVERY_S } from "./thermalRebalanceStore";
import ThermalAura from "./ThermalAura";

export default function CoolingFormationSwarm() {
  const heatModel = useRef(new HeatPropagationModel()).current;
  const votingEngine = useRef(new ThermalVotingEngine()).current;

  useFrame((state) => {
    const st = useThermalRebalanceStore.getState();
    if (!st.simRunning) return;

    const dt = Math.min(state.clock.getDelta(), 0.05);
    const time = state.clock.elapsedTime;
    const heatSource = new THREE.Vector3(0, 0, 0);

    const next = st.agents.map((a) => ({
      ...a,
      position: { ...a.position },
      velocity: { ...a.velocity },
    }));

    let emergencyEver = st.emergencyEver;
    let emergencyStartedAt = st.emergencyStartedAt;
    let coolingSuccess = st.coolingSuccess;

    for (let i = 0; i < next.length; i++) {
      const agent = next[i]!;
      const agentPos3D = new THREE.Vector3(agent.position.x, 0, agent.position.z);
      const distanceToHeat = agentPos3D.distanceTo(heatSource);

      agent.temperature += heatModel.getHeatingRate(distanceToHeat) * dt * 18;
      const speed = Math.hypot(agent.velocity.x, agent.velocity.z);
      agent.temperature -= heatModel.getCoolingRate(speed) * dt * 22;
      agent.temperature = Math.max(18, Math.min(105, agent.temperature));

      if (agent.temperature > 80 && !agent.emergencyActive) {
        agent.emergencyActive = true;
        emergencyEver = true;
        if (emergencyStartedAt == null) emergencyStartedAt = time;
      }

      if (agent.emergencyActive) {
        const sep = votingEngine.getSeparationVector(agent, next);
        const shield = votingEngine.calculateShielding(next, heatSource);
        const blend = sep.clone().multiplyScalar(1.8).add(shield.clone().multiplyScalar(1.2));
        if (blend.lengthSq() > 1e-8) {
          blend.normalize().multiplyScalar(0.14);
          agent.velocity.x += blend.x;
          agent.velocity.z += blend.z;
        }
      } else {
        agent.position.x += Math.sin(time * 0.5 + i) * 0.04 * dt * 60;
        agent.position.z += Math.cos(time * 0.3 + i) * 0.03 * dt * 60;
      }

      agent.velocity.x *= 0.94;
      agent.velocity.z *= 0.94;

      agent.position.x += agent.velocity.x * dt * 60 * 0.35;
      agent.position.z += agent.velocity.z * dt * 60 * 0.35;

      agent.position.x = Math.max(-38, Math.min(38, agent.position.x));
      agent.position.z = Math.max(-38, Math.min(38, agent.position.z));

      if (agent.temperature < 58 && agent.emergencyActive) {
        agent.emergencyActive = false;
      }
    }

    const maxT = Math.max(...next.map((a) => a.temperature));

    if (emergencyStartedAt != null && maxT < 60 && !coolingSuccess) {
      coolingSuccess = true;
    }

    const recoveryTime =
      emergencyStartedAt != null ? Math.min(TARGET_RECOVERY_S, Math.max(0, time - emergencyStartedAt)) : 0;

    useThermalRebalanceStore.setState({
      agents: next,
      emergencyEver,
      emergencyStartedAt,
      coolingSuccess,
      recoveryTime,
    });
  });

  const agents = useThermalRebalanceStore((s) => s.agents);

  return (
    <group>
      <Instances limit={8} castShadow>
        <icosahedronGeometry args={[1.05, 1]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.65} roughness={0.32} />
        {agents.map((agent) => (
          <Instance
            key={agent.id}
            position={[agent.position.x, 1.45, agent.position.z]}
            scale={1 + (agent.temperature - 25) / 200}
            color={thermalColor(agent.temperature)}
          />
        ))}
      </Instances>
      {agents.map((agent) => (
        <ThermalAura key={agent.id} agent={agent} />
      ))}
    </group>
  );
}
