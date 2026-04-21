import { useMemo } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";

/** Line from aerial toward victim (coarse sweep / sensor cue). */
export function AerialSweepHint({
  aerial,
  victim,
}: {
  aerial: [number, number, number];
  victim: [number, number, number] | null;
}) {
  const sweepLine = useMemo(() => {
    if (!victim) return null;
    return [new THREE.Vector3(...aerial), new THREE.Vector3(...victim)] as [THREE.Vector3, THREE.Vector3];
  }, [aerial, victim]);
  if (!sweepLine) return null;
  return <Line points={sweepLine} color="#90caf9" lineWidth={2} dashed dashSize={0.4} gapSize={0.25} />;
}
