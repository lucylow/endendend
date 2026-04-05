import { Html } from "@react-three/drei";
import { useMemo } from "react";
import { useArenaObstacleStore } from "@/store/arenaObstacleStore";

export default function ObstacleCourseEnvironment() {
  const obstacles = useArenaObstacleStore((s) => s.obstacles);

  const obstacleMeshes = useMemo(
    () =>
      obstacles.map((o) => (
        <mesh key={o.id} position={[o.x, o.height / 2, o.z]} castShadow receiveShadow>
          <boxGeometry args={[o.halfW * 2, o.height, o.halfD * 2]} />
          <meshStandardMaterial color={o.color} metalness={0.25} roughness={0.75} />
        </mesh>
      )),
    [obstacles],
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshLambertMaterial color="#141416" />
      </mesh>

      <mesh position={[-45, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 22]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>

      <group position={[45, 0.02, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10, 26]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
        <Html position={[0, 2.5, 0]} center transform occlude={false}>
          <div className="pointer-events-none select-none rounded-lg border border-amber-400/50 bg-zinc-950/90 px-3 py-1.5 text-xs font-black tracking-widest text-amber-300 shadow-lg">
            FINISH
          </div>
        </Html>
        <pointLight intensity={2.2} color="#fbbf24" distance={28} position={[0, 6, 0]} />
      </group>

      {obstacleMeshes}

      <ambientLight intensity={0.38} />
      <directionalLight position={[50, 55, 28]} intensity={1.15} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
    </group>
  );
}
