import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { useSwarmStore } from "@/store/swarmStore";
import type { CameraMode } from "@/features/swarm/useSwarmVisualization";
import RobotAgent from "./RobotAgent";
import BlindHandoffOverlay from "./BlindHandoffOverlay";
import TunnelEnvironment from "./TunnelEnvironment";
import ConnectionNetwork from "./ConnectionNetwork";

export interface SwarmScene3DProps {
  cameraMode: CameraMode;
  tunnelMode: boolean;
  showTrails: boolean;
  showConnections: boolean;
  connectionMode?: "relay-chain" | "proximity";
  agentScale: number;
  compact?: boolean;
  animate?: boolean;
}

export default function SwarmScene3D({
  cameraMode,
  tunnelMode,
  showTrails,
  showConnections,
  connectionMode = "relay-chain",
  agentScale,
  compact = false,
  animate = true,
}: SwarmScene3DProps) {
  const agents = useSwarmStore((s) => s.agents);
  const updateAgentPositions = useSwarmStore((s) => s.updateAgentPositions);
  const selectedAgentId = useSwarmStore((s) => s.selectedAgentId);
  const leaderRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const idealFollow = useRef(new THREE.Vector3());
  const idealTop = useRef(new THREE.Vector3(0, 46, 0.1));

  useFrame(() => {
    if (animate) updateAgentPositions();
  });

  useFrame(() => {
    if (controlsRef.current) controlsRef.current.enabled = cameraMode === "orbit";

    if (cameraMode === "follow-leader" && leaderRef.current) {
      const p = leaderRef.current.position;
      idealFollow.current.set(p.x - 9, p.y + 7, p.z + 16);
      camera.position.lerp(idealFollow.current, 0.07);
      camera.lookAt(p);
    } else if (cameraMode === "top-down") {
      camera.position.lerp(idealTop.current, 0.12);
      camera.lookAt(0, 0, 0);
    }
  });

  return (
    <>
      <color attach="background" args={[compact ? "#0a0e1a" : "#060a14"]} />
      <fog attach="fog" args={[compact ? "#0a0e1a" : "#060a14", compact ? 12 : 18, compact ? 55 : 85]} />

      <ambientLight intensity={compact ? 0.28 : 0.38} />
      <directionalLight
        position={[18, 32, 12]}
        intensity={compact ? 0.85 : 1.15}
        castShadow={!compact}
        shadow-mapSize={compact ? [1024, 1024] : [2048, 2048]}
        shadow-camera-far={80}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
      />
      <pointLight position={[-10, 12, 8]} intensity={0.35} color="#38bdf8" />

      {!compact && <Stars radius={70} depth={60} count={2000} factor={2.8} fade speed={0.4} />}

      {tunnelMode && <TunnelEnvironment />}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#12151f" metalness={0.25} roughness={0.92} />
      </mesh>

      <group>
        {agents.map((agent) => (
          <RobotAgent
            key={agent.id}
            ref={agent.role === "explorer" ? leaderRef : undefined}
            agent={agent}
            isLeader={agent.role === "explorer"}
            agentScale={agentScale}
            showTrail={showTrails}
            selected={selectedAgentId === agent.id}
          />
        ))}
      </group>

      <ConnectionNetwork
        agents={agents}
        visible={showConnections}
        mode={connectionMode}
      />

      <BlindHandoffOverlay />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.055}
        minPolarAngle={cameraMode === "orbit" ? Math.PI / 5 : 0}
        maxPolarAngle={cameraMode === "orbit" ? Math.PI / 2.05 : Math.PI / 2}
        minDistance={compact ? 5 : 6}
        maxDistance={compact ? 38 : 70}
        enablePan={!compact}
        autoRotate={compact && cameraMode === "orbit"}
        autoRotateSpeed={0.35}
      />
    </>
  );
}
