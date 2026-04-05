import * as THREE from "three";
import type { Agent } from "@/types";

function getBatteryColor(battery: number): string {
  if (battery < 18) return "#ef4444";
  if (battery < 35) return "#f97316";
  if (battery < 55) return "#eab308";
  return "#22c55e";
}

function BatteryMeter3D({ agent, position }: { agent: Agent; position: [number, number, number] }) {
  const fillHeight = Math.max(0.05, (agent.battery / 100) * 1.2);
  const color = getBatteryColor(agent.battery);

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.4, 1.5, 0.2]} />
        <meshStandardMaterial color="#374151" metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh position={[0, (-1.2 + fillHeight) / 2, 0.11]}>
        <boxGeometry args={[0.35, fillHeight, 0.18]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={agent.battery < 25 ? 0.95 : 0.35}
        />
      </mesh>
      {agent.battery < 22 && (
        <mesh position={[0, 0.85, 0.28]} rotation={[0, 0, Math.PI / 4]}>
          <ringGeometry args={[0.18, 0.24, 16]} />
          <meshBasicMaterial color="#ef4444" toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

export default function BatteryVisualizer3D({ agents }: { agents: Agent[] }) {
  return (
    <group>
      {agents.map((agent, i) => {
        const x = i * 4 - 12;
        const z = agent.position.z;
        const scale = Math.max(0.35, agent.battery / 100);
        const color = new THREE.Color(getBatteryColor(agent.battery));
        return (
          <group key={agent.id}>
            <mesh position={[x, 1.1 + agent.battery * 0.008, z]} scale={scale} castShadow>
              <dodecahedronGeometry args={[0.75, 0]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.35}
                metalness={0.88}
                roughness={0.2}
              />
            </mesh>
            <BatteryMeter3D agent={agent} position={[x, 3.1, z]} />
          </group>
        );
      })}
    </group>
  );
}

export { getBatteryColor };
