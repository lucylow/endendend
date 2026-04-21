import { useMemo } from "react";
import * as THREE from "three";

type Bounds = { xmin: number; xmax: number; zmin: number; zmax: number };

export function TerrainField({ bounds }: { bounds: Bounds }) {
  const { xmin, xmax, zmin, zmax } = bounds;
  const cx = (xmin + xmax) / 2;
  const cz = (zmin + zmax) / 2;
  const wx = xmax - xmin + 20;
  const wz = zmax - zmin + 20;

  const grid = useMemo(() => {
    const g = new THREE.GridHelper(Math.max(wx, wz), 40, "#334155", "#1e293b");
    g.position.y = 0.02;
    return g;
  }, [wx, wz]);

  return (
    <group position={[cx, 0, cz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[wx, wz, 1, 1]} />
        <meshStandardMaterial color="#252530" roughness={0.92} metalness={0.05} />
      </mesh>
      <primitive object={grid} />
    </group>
  );
}
