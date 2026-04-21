import type { RoverState } from "@/stores/swarmStore";

export function GroundRover3D({ rover, highlight }: { rover: RoverState; highlight: boolean }) {
  return (
    <mesh position={rover.position} castShadow>
      <boxGeometry args={[1.1, 0.55, 0.9]} />
      <meshStandardMaterial
        color={highlight ? "#ffd54f" : "#4caf50"}
        emissive={highlight ? "#553300" : "#002200"}
        emissiveIntensity={highlight ? 0.35 : 0.08}
        metalness={0.15}
        roughness={0.55}
      />
    </mesh>
  );
}
