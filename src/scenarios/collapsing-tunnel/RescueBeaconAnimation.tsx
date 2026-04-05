import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useCollapsingTunnelStore } from "./collapsingTunnelStore";

export default function RescueBeaconAnimation() {
  const mesh = useRef<THREE.Mesh>(null);
  const beaconSent = useCollapsingTunnelStore((s) => s.beaconSent);

  useFrame((state) => {
    if (!mesh.current || !beaconSent) return;
    const w = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.12;
    mesh.current.scale.setScalar(w);
  });

  if (!beaconSent) return null;

  return (
    <mesh ref={mesh} position={[0, 3.2, 32]}>
      <sphereGeometry args={[1.1, 20, 20]} />
      <meshStandardMaterial color="#34d399" emissive="#10b981" emissiveIntensity={1.2} transparent opacity={0.85} />
    </mesh>
  );
}
