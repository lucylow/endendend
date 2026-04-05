import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Agent } from "@/types";
import { expandHeroAgents } from "./expandHeroAgents";
import { heroWorldPose } from "./heroFormationMath";

const TARGET = 200;
const RING_COUNT = 36;

interface HealthIndicatorsProps {
  agents: Agent[];
}

export default function HealthIndicators({ agents }: HealthIndicatorsProps) {
  const field = useMemo(() => expandHeroAgents(agents, TARGET), [agents]);
  const subset = useMemo(() => {
    const out: { agent: Agent; index: number }[] = [];
    for (let i = 0; i < field.length && out.length < RING_COUNT; i++) {
      if (i % 5 === 0 || field[i].battery < 28) out.push({ agent: field[i], index: i });
    }
    return out;
  }, [field]);

  return (
    <>
      {subset.map(({ agent, index }) => (
        <HealthRing key={`${agent.id}-${index}`} agent={agent} index={index} total={field.length} />
      ))}
    </>
  );
}

function HealthRing({ agent, index, total }: { agent: Agent; index: number; total: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const batBucket = Math.floor(agent.battery / 4);

  const color =
    agent.battery > 50 ? "#34d399" : agent.battery > 20 ? "#fbbf24" : "#f87171";

  const theta = Math.max(0.12, (agent.battery / 100) * Math.PI * 2);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.85;
    const p = heroWorldPose(agent, index, total, t);
    const g = groupRef.current;
    if (!g) return;
    const pulse = agent.battery < 20 ? 1 + Math.sin(state.clock.elapsedTime * 6) * 0.11 : 1;
    const base = p.scale * 0.55;
    g.position.set(p.x, p.y + 0.95 * p.scale, p.z);
    g.scale.setScalar(base * pulse);
  });

  return (
    <group ref={groupRef} renderOrder={2}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 0.88, 40]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh key={batBucket} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.62, 0.78, 48, 1, -Math.PI / 2, theta]} />
        <meshBasicMaterial color={color} transparent opacity={0.92} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
