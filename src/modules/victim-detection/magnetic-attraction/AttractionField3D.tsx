import { useMemo } from "react";
import { DoubleSide } from "three";
import type { FusedVictim } from "../types";

function priorityColor(priority: number): string {
  if (priority > 0.75) return "#22d3ee";
  if (priority > 0.55) return "#a78bfa";
  return "#64748b";
}

export function AttractionField3D({
  victim,
}: {
  victim: FusedVictim;
}) {
  const strength = Math.max(0.15, victim.fusedScore * victim.priority);
  const color = priorityColor(victim.priority);
  const scale = useMemo(() => 1.2 + strength * 4, [strength]);

  return (
    <group position={[victim.worldPos.x, victim.worldPos.y, victim.worldPos.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[scale * 0.8, scale * 1.4, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[scale * 0.35, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}
