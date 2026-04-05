import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Trail, Text } from "@react-three/drei";
import * as THREE from "three";
import type { Agent } from "@/types";
import type { HealthStatus } from "@/features/health/types";
import { BatteryMeter3D } from "@/components/health/BatteryMeter3D";
import { CriticalFlash3D } from "@/components/health/CriticalFlash3D";
import { HealthStatusRing } from "@/components/health/HealthStatusRing";

export interface RobotAgentProps {
  agent: Agent;
  isLeader?: boolean;
  agentScale?: number;
  showTrail?: boolean;
  selected?: boolean;
}

const RobotAgent = forwardRef<THREE.Group, RobotAgentProps>(function RobotAgent(
  { agent, isLeader = false, agentScale = 1, showTrail = true, selected = false },
  ref,
) {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  useImperativeHandle(ref, () => groupRef.current!, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.08 + 0.92;
    const offlineDim = agent.status === "offline" ? 0.22 : 1;
    mat.emissiveIntensity =
      (agent.battery / 100) * 0.45 * pulse * (isLeader ? 1.35 : 1) * offlineDim;
    mesh.rotation.y += agent.status === "offline" ? 0.004 : 0.012;
  });

  const color = useMemo(() => {
    if (agent.color) return agent.color;
    switch (agent.role) {
      case "explorer":
        return "#10b981";
      case "relay":
        return "#3b82f6";
      case "standby":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  }, [agent.role, agent.color]);

  const scale = (0.82 + (agent.battery / 100) * 0.45) * agentScale;

  const healthStatus: HealthStatus =
    agent.status === "offline" ? "offline" : (agent.healthStatus ?? "healthy");
  const ringHealth = agent.vitals?.healthScore ?? agent.battery;

  const body = useMemo(() => {
    const mat = (
      <meshPhysicalMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.35}
        metalness={0.92}
        roughness={0.1}
        clearcoat={0.5}
        clearcoatRoughness={0.2}
        envMapIntensity={1.4}
      />
    );
    if (agent.platform === "aerial") {
      return (
        <mesh ref={meshRef} castShadow receiveShadow rotation={[Math.PI / 2, 0, 0.35]}>
          <coneGeometry args={[isLeader ? 0.4 : 0.32, 0.56, 6]} />
          {mat}
        </mesh>
      );
    }
    if (agent.platform === "ground") {
      return (
        <mesh ref={meshRef} castShadow receiveShadow>
          <boxGeometry args={[isLeader ? 0.58 : 0.5, 0.24, isLeader ? 0.76 : 0.64]} />
          {mat}
        </mesh>
      );
    }
    return (
      <mesh ref={meshRef} castShadow receiveShadow>
        <icosahedronGeometry args={[isLeader ? 0.42 : 0.34, 2]} />
        {mat}
      </mesh>
    );
  }, [agent.platform, isLeader, color]);

  return (
    <group
      ref={groupRef}
      position={[agent.position.x, agent.position.y, agent.position.z]}
      scale={scale}
    >
      {showTrail ? (
        <Trail
          width={0.14}
          length={28}
          decay={0.88}
          stride={0.02}
          color={color}
          attenuation={(w) => w * w}
        >
          {body}
        </Trail>
      ) : (
        body
      )}

      <Text
        position={[0, 0.72, 0]}
        fontSize={0.2}
        anchorX="center"
        anchorY="middle"
        color="#f8fafc"
        outlineWidth={0.025}
        outlineColor="#020617"
      >
        {agent.platform ? `${agent.platform.toUpperCase()} · ${agent.role}` : agent.role.toUpperCase()}
      </Text>

      <group position={[0, 0.02, 0]}>
        <HealthStatusRing health={ringHealth} status={healthStatus} />
      </group>

      <BatteryMeter3D battery={agent.battery} position={[0.52, 0.15, 0]} scale={0.95} />

      {healthStatus === "critical" && <CriticalFlash3D />}

      {selected && (
        <mesh>
          <sphereGeometry args={[0.75, 16, 16]} />
          <meshBasicMaterial color="#a5f3fc" wireframe transparent opacity={0.2} />
        </mesh>
      )}
    </group>
  );
});

export default RobotAgent;
