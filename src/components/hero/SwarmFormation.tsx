import { useRef, useMemo, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Agent } from "@/types";
import { expandHeroAgents } from "./expandHeroAgents";
import { heroWorldPose, roleColor } from "./heroFormationMath";

const TARGET = 200;

interface SwarmFormationProps {
  agents: Agent[];
}

export default function SwarmFormation({ agents }: SwarmFormationProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const field = useMemo(() => expandHeroAgents(agents, TARGET), [agents]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < field.length; i++) {
      color.set(roleColor(field[i].role));
      mesh.setColorAt(i, color);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [field, color]);

  const [geo, mat] = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.28, 2);
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#d0e8ff"),
      metalness: 0.95,
      roughness: 0.08,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.8,
      vertexColors: true,
    });
    return [g, m];
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime * 0.85;
    const n = field.length;

    for (let i = 0; i < n; i++) {
      const agent = field[i];
      const p = heroWorldPose(agent, i, n, t);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.rotY, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, field.length]}
      frustumCulled={false}
      castShadow
      receiveShadow
    />
  );
}
