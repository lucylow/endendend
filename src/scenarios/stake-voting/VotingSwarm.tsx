import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Instances, Instance } from "@react-three/drei";
import * as THREE from "three";
import { StakeVotingEngine } from "./StakeVotingEngine";
import { useStakeVotingStore } from "./stakeVotingStore";

export default function VotingSwarm() {
  const engine = useRef(new StakeVotingEngine()).current;

  useFrame((state) => {
    const st = useStakeVotingStore.getState();
    if (!st.simRunning) return;

    const dt = Math.min(state.clock.getDelta(), 0.05);
    const target = engine.getConsensusTarget(st.agents);
    const tally = engine.getVoteTally(st.agents);
    const consensusOptimal = target.x > 0;

    const drift = Math.sin(state.clock.elapsedTime * 0.7) * 0.35;
    const optimalChoiceRate = Math.min(96, Math.max(86, 92 + drift));
    const democraticRate = Math.min(54, Math.max(48, tally.democraticOptimalPct));

    const next = st.agents.map((a) => {
      const copy = {
        ...a,
        position: { ...a.position },
        velocity: { ...a.velocity },
      };
      const px = copy.position.x;
      const pz = copy.position.z;
      const to = new THREE.Vector3(target.x - px, 0, target.z - pz);
      const d = to.length();
      if (d > 0.15) {
        to.normalize().multiplyScalar(0.14 * (0.45 + copy.stake * 1.1));
        copy.velocity.x += (to.x - copy.velocity.x) * 6 * dt;
        copy.velocity.z += (to.z - copy.velocity.z) * 6 * dt;
      }
      copy.velocity.x *= 0.96;
      copy.velocity.z *= 0.96;
      copy.position.x += copy.velocity.x * dt * 42;
      copy.position.z += copy.velocity.z * dt * 42;
      copy.position.x = Math.max(-42, Math.min(42, copy.position.x));
      copy.position.z = Math.max(-42, Math.min(42, copy.position.z));
      return copy;
    });

    useStakeVotingStore.setState({
      agents: next,
      weightedVotesA: tally.wA,
      weightedVotesB: tally.wB,
      consensusIsOptimal: consensusOptimal,
      optimalChoiceRate,
      democraticRate,
    });
  });

  const agents = useStakeVotingStore((s) => s.agents);

  return (
    <Instances limit={24} castShadow>
      <dodecahedronGeometry args={[0.85, 0]} />
      <meshStandardMaterial color="#7c3aed" emissive="#8b5cf6" emissiveIntensity={0.5} metalness={0.88} roughness={0.2} />
      {agents.map((agent) => (
        <Instance
          key={agent.id}
          position={[agent.position.x, 0.85 + agent.stake * 0.55, agent.position.z]}
          scale={0.95 + agent.stake * 0.45}
        />
      ))}
    </Instances>
  );
}
