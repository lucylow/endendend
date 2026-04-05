import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { ResilienceSimAgent } from "./randomFailureStore";

function DeadAgentDebris({ agents }: { agents: ResilienceSimAgent[] }) {
  return (
    <group>
      {agents
        .filter((a) => !a.alive)
        .map((a) => (
          <group key={a.id} position={[a.position.x, a.position.y * 0.2, a.position.z]}>
            <mesh castShadow>
              <tetrahedronGeometry args={[0.55, 0]} />
              <meshStandardMaterial color="#57534e" emissive="#450a0a" emissiveIntensity={0.25} metalness={0.4} roughness={0.6} transparent opacity={0.75} />
            </mesh>
          </group>
        ))}
    </group>
  );
}

function RoleReassignmentLines({ agents }: { agents: ResilienceSimAgent[] }) {
  const leader = agents.find((a) => a.alive && a.role === "leader");
  const relays = agents.filter((a) => a.alive && a.role === "relay");
  if (!leader) return null;

  const segments: THREE.Vector3[][] = [];
  for (const r of relays) {
    segments.push([
      new THREE.Vector3(leader.position.x, leader.position.y + 0.2, leader.position.z),
      new THREE.Vector3(r.position.x, r.position.y + 0.2, r.position.z),
    ]);
  }

  return (
    <group>
      {segments.map((pts, i) => (
        <Line key={i} points={pts} color="#fbbf24" lineWidth={1.5} />
      ))}
    </group>
  );
}

export default function FailureVisualizer({ agents }: { agents: ResilienceSimAgent[] }) {
  return (
    <group>
      <DeadAgentDebris agents={agents} />
      <RoleReassignmentLines agents={agents} />
    </group>
  );
}
