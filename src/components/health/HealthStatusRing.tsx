import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { HealthStatus } from "@/features/health/types";

export interface HealthStatusRingProps {
  /** 0–100 vitals fill */
  health: number;
  status: HealthStatus;
}

export function HealthStatusRing({ health, status }: HealthStatusRingProps) {
  const groupRef = useRef<THREE.Group>(null);
  const fillRef = useRef<THREE.Mesh>(null);
  const trackRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const fillMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const trackMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const style = useMemo(() => {
    switch (status) {
      case "healthy":
        return { color: "#10b981", emissiveIntensity: 0.48, trackOpacity: 0.2, haloOpacity: 0.06 };
      case "warning":
        return { color: "#f59e0b", emissiveIntensity: 0.72, trackOpacity: 0.26, haloOpacity: 0.08 };
      case "degraded":
        return { color: "#f97316", emissiveIntensity: 0.82, trackOpacity: 0.3, haloOpacity: 0.09 };
      case "critical":
        return { color: "#ef4444", emissiveIntensity: 1.15, trackOpacity: 0.38, haloOpacity: 0.12 };
      case "offline":
        return { color: "#64748b", emissiveIntensity: 0.06, trackOpacity: 0.12, haloOpacity: 0.04 };
    }
  }, [status]);

  const thetaLen = Math.max(0.02, (Math.min(100, health) / 100) * Math.PI * 2);

  useFrame((state) => {
    const g = groupRef.current;
    const fill = fillRef.current;
    const halo = haloRef.current;
    const fillMat = fillMatRef.current;
    const trackMat = trackMatRef.current;
    if (!g || !fill || !fillMat || !trackMat) return;

    const t = state.clock.elapsedTime;

    if (status === "critical") {
      const pulse = Math.sin(t * 7.2) * 0.11 + 1;
      g.scale.setScalar(pulse);
      const flicker = 0.82 + Math.sin(t * 11) * 0.14;
      fillMat.emissiveIntensity = style.emissiveIntensity * flicker;
      fillMat.opacity = 0.78 + Math.sin(t * 9) * 0.12;
    } else if (status === "warning" || status === "degraded") {
      g.scale.setScalar(1);
      const breathe = 0.92 + Math.sin(t * 2.4) * 0.08;
      fillMat.emissiveIntensity = style.emissiveIntensity * breathe;
      fillMat.opacity = 0.86;
    } else {
      g.scale.setScalar(1);
      fillMat.emissiveIntensity = style.emissiveIntensity;
      fillMat.opacity = status === "offline" ? 0.35 : 0.9;
    }

    trackMat.opacity = style.trackOpacity * (status === "offline" ? 0.65 : 1);

    fill.rotation.z = t * (status === "offline" ? 0 : 0.12);

    if (halo) {
      halo.rotation.z = -t * 0.05;
      const hm = halo.material as THREE.MeshStandardMaterial;
      hm.opacity = style.haloOpacity * (0.85 + Math.sin(t * 1.8) * 0.15);
    }
  });

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={haloRef} renderOrder={0}>
        <ringGeometry args={[1.38, 1.52, 48, 1, 0, Math.PI * 2]} />
        <meshStandardMaterial
          color={style.color}
          transparent
          opacity={style.haloOpacity}
          side={THREE.DoubleSide}
          emissive={style.color}
          emissiveIntensity={style.emissiveIntensity * 0.12}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={trackRef} renderOrder={1}>
        <ringGeometry args={[1.1, 1.36, 64, 1, 0, Math.PI * 2]} />
        <meshStandardMaterial
          ref={trackMatRef}
          color={style.color}
          transparent
          opacity={style.trackOpacity}
          side={THREE.DoubleSide}
          emissive={style.color}
          emissiveIntensity={style.emissiveIntensity * 0.22}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={fillRef} renderOrder={2}>
        <ringGeometry args={[1.1, 1.36, 64, 1, -Math.PI / 2, thetaLen]} />
        <meshStandardMaterial
          ref={fillMatRef}
          color={style.color}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          emissive={style.color}
          emissiveIntensity={style.emissiveIntensity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
