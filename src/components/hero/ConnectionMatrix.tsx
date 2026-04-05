import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Agent } from "@/types";
import { expandHeroAgents } from "./expandHeroAgents";
import { heroWorldPose } from "./heroFormationMath";

const TARGET = 200;
const MAX_RELAYS = 14;

interface ConnectionMatrixProps {
  agents: Agent[];
}

export default function ConnectionMatrix({ agents }: ConnectionMatrixProps) {
  const field = useMemo(() => expandHeroAgents(agents, TARGET), [agents]);
  const relaySlots = useMemo(() => {
    const slots: { agent: Agent; index: number }[] = [];
    for (let i = 0; i < field.length && slots.length < MAX_RELAYS; i++) {
      if (field[i].role === "relay") slots.push({ agent: field[i], index: i });
    }
    return slots;
  }, [field]);

  const segCount = Math.max(0, relaySlots.length - 1);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(Math.max(1, segCount * 2) * 3);
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [segCount]);

  const mat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color("#3b82f6"),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    [],
  );

  const lineRef = useRef<THREE.LineSegments>(null);

  useFrame((state) => {
    const line = lineRef.current;
    if (!line || segCount === 0) return;
    const t = state.clock.elapsedTime * 0.85;
    const pos = line.geometry.attributes.position.array as Float32Array;
    let o = 0;
    for (let r = 0; r < segCount; r++) {
      const a = relaySlots[r];
      const b = relaySlots[r + 1];
      const pa = heroWorldPose(a.agent, a.index, TARGET, t);
      const pb = heroWorldPose(b.agent, b.index, TARGET, t);
      pos[o++] = pa.x;
      pos[o++] = pa.y + 0.2 * pa.scale;
      pos[o++] = pa.z;
      pos[o++] = pb.x;
      pos[o++] = pb.y + 0.2 * pb.scale;
      pos[o++] = pb.z;
    }
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  });

  if (segCount === 0) return null;

  return <lineSegments ref={lineRef} geometry={geom} material={mat} frustumCulled={false} />;
}
