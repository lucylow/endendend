import { useEffect, useMemo } from "react";
import * as THREE from "three";

export function GlobalMapOverlay({ map }: { map: number[][] }) {
  const texture = useMemo(() => {
    const rows = map.length;
    const cols = map[0]?.length ?? 0;
    if (!rows || !cols) return null;

    const data = new Uint8Array(cols * rows * 4);
    let max = 1e-6;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        max = Math.max(max, map[y]?.[x] ?? 0);
      }
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = (map[y]?.[x] ?? 0) / max;
        const i = (y * cols + x) * 4;
        data[i] = Math.floor(40 + v * 200);
        data[i + 1] = Math.floor(20 + v * 180);
        data[i + 2] = Math.floor(80 + v * 120);
        data[i + 3] = Math.floor(40 + v * 180);
      }
    }
    const tex = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat);
    tex.flipY = true;
    tex.needsUpdate = true;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, [map]);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  if (!texture) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[50, 0.12, 50]}>
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} opacity={0.55} />
    </mesh>
  );
}
