import { Line } from "@react-three/drei";
import { useMemo } from "react";
import { useSwarmStore } from "@/store/swarmStore";

/**
 * Visualizes air-to-ground blind handoff: victim marker + dashed aerial→victim + solid rescuer→victim.
 */
export default function BlindHandoffOverlay() {
  const overlay = useSwarmStore((s) => s.blindHandoffOverlay);
  const agents = useSwarmStore((s) => s.agents);

  const geo = useMemo(() => {
    if (!overlay) return null;
    const aerial = agents.find((a) => a.id === overlay.aerialId);
    const rescuer = overlay.rescuerId ? agents.find((a) => a.id === overlay.rescuerId) : null;
    const v = overlay.victim;
    if (!aerial) return null;
    const ap: [number, number, number] = [aerial.position.x, aerial.position.y + 0.35, aerial.position.z];
    const vp: [number, number, number] = [v.x, v.y + 0.12, v.z];
    const rp: [number, number, number] | null = rescuer
      ? [rescuer.position.x, rescuer.position.y + 0.2, rescuer.position.z]
      : null;
    return { ap, vp, rp };
  }, [overlay, agents]);

  if (!overlay || !geo) return null;

  const showAerialLine = overlay.phase === "request" || overlay.phase === "bidding";
  const showRescuerLine = overlay.phase === "accepted" || overlay.phase === "complete";
  const victimColor =
    overlay.phase === "complete" ? "#22c55e" : "#ef4444";

  return (
    <group>
      <mesh position={[overlay.victim.x, overlay.victim.y + 0.1, overlay.victim.z]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color={victimColor} emissive={victimColor} emissiveIntensity={0.35} />
      </mesh>

      {showAerialLine && (
        <Line
          points={[geo.ap, geo.vp]}
          color="#38bdf8"
          lineWidth={1.8}
          dashed
          dashSize={0.45}
          gapSize={0.28}
          transparent
          opacity={0.85}
        />
      )}

      {showRescuerLine && geo.rp && (
        <Line
          points={[geo.rp, geo.vp]}
          color="#fbbf24"
          lineWidth={2.4}
          transparent
          opacity={0.92}
        />
      )}
    </group>
  );
}
