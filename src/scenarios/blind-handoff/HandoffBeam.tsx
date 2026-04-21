import { useMemo } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";

export function HandoffBeam({
  from,
  to,
  visible,
}: {
  from: [number, number, number];
  to: [number, number, number];
  visible: boolean;
}) {
  const pts = useMemo(
    () => [new THREE.Vector3(...from), new THREE.Vector3(...to)] as [THREE.Vector3, THREE.Vector3],
    [from, to],
  );
  if (!visible) return null;
  return <Line points={pts} color="#e040fb" lineWidth={2.2} dashed dashSize={0.35} gapSize={0.22} />;
}
