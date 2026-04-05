import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface BatteryMeter3DProps {
  battery: number;
  position?: [number, number, number];
  scale?: number;
}

function batteryColor(battery: number): string {
  if (battery > 70) return "#10b981";
  if (battery > 30) return "#f59e0b";
  return "#ef4444";
}

export function BatteryMeter3D({ battery, position = [0, 0, 0], scale = 1 }: BatteryMeter3DProps) {
  const b = Math.min(100, Math.max(0, battery));
  const fillHeight = (b / 100) * 0.72;
  const yFill = 0.18 - (0.72 - fillHeight) / 2;
  const fillColor = batteryColor(b);

  const ledMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const fillMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  const low = b <= 20;
  const warn = b > 20 && b <= 35;

  const caseMetal = useMemo(
    () => ({ color: "#0f172a", metalness: 0.82, roughness: 0.22 }),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const led = ledMatRef.current;
    const fillM = fillMatRef.current;
    const g = groupRef.current;
    if (!led || !fillM || !g) return;

    if (low) {
      const blink = 0.5 + Math.abs(Math.sin(t * 9)) * 0.5;
      led.emissiveIntensity = 0.4 + blink * 1.4;
      fillM.emissiveIntensity = 0.35 + blink * 0.55;
      g.position.y = position[1] + Math.sin(t * 14) * 0.012;
    } else if (warn) {
      led.emissiveIntensity = 0.75 + Math.sin(t * 3) * 0.2;
      fillM.emissiveIntensity = 0.22 + (b / 100) * 0.62;
      g.position.y = position[1];
    } else {
      led.emissiveIntensity = 0.95 + Math.sin(t * 2) * 0.08;
      fillM.emissiveIntensity = 0.12 + (b / 100) * 0.78;
      g.position.y = position[1];
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[0.28, 0.76, 0.12]} />
        <meshStandardMaterial {...caseMetal} />
      </mesh>
      <mesh position={[0, 0.18, 0.001]} renderOrder={1}>
        <boxGeometry args={[0.24, 0.68, 0.11]} />
        <meshStandardMaterial color="#020617" metalness={0.5} roughness={0.85} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <mesh position={[0, yFill, 0.055]} renderOrder={2}>
        <boxGeometry args={[0.2, Math.max(0.04, fillHeight), 0.08]} />
        <meshStandardMaterial
          ref={fillMatRef}
          color={fillColor}
          emissive={fillColor}
          emissiveIntensity={0.12 + (b / 100) * 0.75}
          metalness={0.15}
          roughness={0.4}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0.12, 0.42, 0.065]} renderOrder={3}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshStandardMaterial
          ref={ledMatRef}
          color={low ? "#ef4444" : "#22c55e"}
          emissive={low ? "#ef4444" : "#22c55e"}
          emissiveIntensity={low ? 1.2 : 1}
          metalness={0.05}
          roughness={0.35}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.54, 0]} castShadow>
        <boxGeometry args={[0.12, 0.08, 0.1]} />
        <meshStandardMaterial color="#1e293b" metalness={0.65} roughness={0.32} />
      </mesh>
    </group>
  );
}
