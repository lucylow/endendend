import { useMemo } from "react";
import * as THREE from "three";
import type { MagneticSimAgent } from "./magneticAttractionStore";

export default function AttractionFieldLines({
  agents,
  target,
}: {
  agents: MagneticSimAgent[];
  target: THREE.Vector3;
}) {
  const geoms = useMemo(() => {
    return agents.map((agent) => {
      const from = new THREE.Vector3(agent.position.x, 1.1 + agent.stakeAmount * 0.001, agent.position.z);
      const g = new THREE.BufferGeometry().setFromPoints([from, target.clone()]);
      return { id: agent.id, geom: g };
    });
  }, [agents, target]);

  return (
    <group>
      {geoms.map(({ id, geom }) => (
        <primitive key={id} object={new THREE.Line(geom, new THREE.LineBasicMaterial({ color: "#c4b5fd", transparent: true, opacity: 0.35 }))} />
      ))}
    </group>
  );
}
