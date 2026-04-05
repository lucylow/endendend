import { useLayoutEffect } from "react";
import { OrbitControls, Stars } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import DualSwarmEnvironment from "./DualSwarmEnvironment";
import SwarmAExploration from "./SwarmAExploration";
import SwarmBHeavyLift from "./SwarmBHeavyLift";
import HandoffSuccessAnimation from "./HandoffSuccessAnimation";

export default function MultiSwarmHandoffScene() {
  const { camera } = useThree();
  useLayoutEffect(() => {
    camera.position.set(0, 20, 50);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      <color attach="background" args={["#070b12"]} />
      <fog attach="fog" args={["#070b12", 22, 95]} />
      <ambientLight intensity={0.32} />
      <directionalLight position={[12, 36, 18]} intensity={1.05} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-20, 12, 10]} intensity={0.35} color="#38bdf8" />
      <Stars radius={85} depth={70} count={1600} factor={2.2} fade speed={0.3} />

      <DualSwarmEnvironment />
      <SwarmAExploration />
      <SwarmBHeavyLift />
      <HandoffSuccessAnimation />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI / 2.03}
        minDistance={14}
        maxDistance={88}
      />
    </>
  );
}
