import { useMemo } from "react";
import * as THREE from "three";
import type { Agent } from "@/types";

export default function RelayChainLines({ agents }: { agents: Agent[] }) {
  const points = useMemo(() => {
    const sorted = [...agents].filter((a) => a.status === "active").sort((a, b) => b.position.z - a.position.z);
    if (sorted.length < 2) return null;
    const arr: THREE.Vector3[] = [];
    for (const a of sorted) {
      arr.push(new THREE.Vector3(a.position.x, 1.2, a.position.z));
    }
    return arr;
  }, [agents]);

  if (!points || points.length < 2) return null;

  const curve = new THREE.CatmullRomCurve3(points);
  const geom = new THREE.TubeGeometry(curve, Math.max(8, points.length * 4), 0.06, 8, false);

  return (
    <mesh geometry={geom}>
      <meshStandardMaterial color="#34d399" emissive="#065f46" emissiveIntensity={0.4} transparent opacity={0.85} />
    </mesh>
  );
}
