import type { VictimJson } from "./types";

export function VictimMarkers({
  victims,
  activeCoords,
}: {
  victims: VictimJson[];
  activeCoords: [number, number, number] | null;
}) {
  return (
    <>
      {victims.map((v) => {
        const p = v.pos;
        const isActive =
          activeCoords &&
          Math.hypot(p[0] - activeCoords[0], p[2] - activeCoords[2]) < 0.75 &&
          Math.abs(p[1] - activeCoords[1]) < 1.2;
        return (
          <mesh key={v.id} position={p} castShadow>
            <sphereGeometry args={[isActive ? 0.95 : 0.55, 20, 20]} />
            <meshStandardMaterial
              color={isActive ? "#ff7043" : "#5c6bc0"}
              emissive={isActive ? "#331100" : "#0a0a22"}
              emissiveIntensity={isActive ? 0.45 : 0.12}
            />
          </mesh>
        );
      })}
    </>
  );
}
