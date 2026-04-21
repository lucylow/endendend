import { useMemo } from "react";
import * as THREE from "three";

export function SectorGrid({
  bounds,
  opacity = 0.45,
  color,
}: {
  bounds: [number, number, number, number];
  opacity?: number;
  color: string;
}) {
  const [x1, x2, z1, z2] = bounds;
  const w = Math.max(0.01, x2 - x1);
  const h = Math.max(0.01, z2 - z1);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.06, cz]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} wireframe />
    </mesh>
  );
}

/** 10m major grid on the 100m field for judge orientation. */
export function FieldGridLines() {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pts: number[] = [];
    const s = 100;
    const step = 10;
    for (let x = 0; x <= s; x += step) {
      pts.push(x, 0.08, 0, x, 0.08, s);
    }
    for (let z = 0; z <= s; z += step) {
      pts.push(0, 0.08, z, s, 0.08, z);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color="#3d5a45" transparent opacity={0.35} />
    </lineSegments>
  );
}
