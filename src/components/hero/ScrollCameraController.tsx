import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Parallax camera driven by window scroll (hero is full-viewport; progress eases off past first screen).
 */
export default function ScrollCameraController() {
  const { camera } = useThree();

  useFrame(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const h = window.innerHeight || 1;
    const p = Math.min(1, Math.max(0, window.scrollY / (h * 0.95)));
    const e = 1 - Math.pow(1 - p, 1.35);
    camera.position.y = 10 + e * 8;
    camera.position.x = Math.sin(p * Math.PI * 0.35) * 1.2;
    camera.position.z = 25 + e * 16;
    camera.lookAt(0, 4 + e * 3.5, -e * 2);
  });

  return null;
}
