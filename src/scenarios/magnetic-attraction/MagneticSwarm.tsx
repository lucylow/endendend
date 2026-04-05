import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Instances, Instance } from "@react-three/drei";
import * as THREE from "three";
import { VictimPriorityModel } from "./VictimPriorityModel";
import { AttractionFieldEngine } from "./AttractionFieldEngine";
import { useMagneticAttractionStore } from "./magneticAttractionStore";
import AttractionFieldLines from "./AttractionFieldLines";

export default function MagneticSwarm() {
  const priorityModel = useRef(new VictimPriorityModel()).current;
  const attractionEngine = useRef(new AttractionFieldEngine()).current;

  useFrame((state) => {
    const st = useMagneticAttractionStore.getState();
    if (!st.simRunning) return;

    const dt = Math.min(state.clock.getDelta(), 0.05);
    const victims = st.victims;
    const next = st.agents.map((a) => ({ ...a, position: { ...a.position }, velocity: { ...a.velocity } }));

    const best = victims.reduce((a, b) => (a.value >= b.value ? a : b));
    let sumDist = 0;
    let nearOptimal = 0;

    for (const agent of next) {
      const net = priorityModel.getNetAttraction(agent, next, victims);
      const consensus = attractionEngine.getConsensusAttraction(agent, next, net);
      if (consensus.lengthSq() > 1e-10) {
        agent.velocity.x += consensus.x * 0.11 * dt * 55;
        agent.velocity.z += consensus.z * 0.11 * dt * 55;
      }

      agent.velocity.x *= 0.965;
      agent.velocity.z *= 0.965;

      agent.position.x += agent.velocity.x * dt * 45;
      agent.position.z += agent.velocity.z * dt * 45;

      agent.position.x = Math.max(-48, Math.min(48, agent.position.x));
      agent.position.z = Math.max(-48, Math.min(48, agent.position.z));

      const stakeN = agent.stakeAmount / 500;
      agent.vizScale = 1 + stakeN * 0.45;
      agent.emissiveIntensity = 0.35 + stakeN * 0.85;

      const dx = agent.position.x - best.x;
      const dz = agent.position.z - best.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      sumDist += d;
      if (d < 12) nearOptimal += 1;
    }

    const avgDist = sumDist / Math.max(1, next.length);
    const optimalRate = Math.min(96, 58 + nearOptimal * 6.5 - avgDist * 0.08);

    useMagneticAttractionStore.setState({
      agents: next,
      optimalSelectionRate: optimalRate,
      convergenceTargetId: best.id,
      attractionActive: true,
    });
  });

  const agents = useMagneticAttractionStore((s) => s.agents);
  const victims = useMagneticAttractionStore((s) => s.victims);
  const target = useMemo(() => {
    const best = victims.reduce((a, b) => (a.value >= b.value ? a : b));
    return new THREE.Vector3(best.x, 1.2, best.z);
  }, [victims]);

  return (
    <group>
      <Instances limit={16} castShadow>
        <icosahedronGeometry args={[0.75, 1]} />
        <meshStandardMaterial color="#7c3aed" emissive="#8b5cf6" emissiveIntensity={0.55} metalness={0.88} roughness={0.22} />
        {agents.map((agent) => (
          <Instance
            key={agent.id}
            position={[agent.position.x, 0.9 + agent.stakeAmount * 0.0012, agent.position.z]}
            scale={agent.vizScale}
          />
        ))}
      </Instances>
      <AttractionFieldLines agents={agents} target={target} />
    </group>
  );
}
