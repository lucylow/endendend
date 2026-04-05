import { useMemo } from "react";
import * as THREE from "three";
import type { Agent } from "@/types";
import type { FusedVictim } from "../types";

function ConvergenceBeam({
  from,
  to,
}: {
  from: [number, number, number];
  to: [number, number, number];
}) {
  const geom = useMemo(
    () =>
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...from), new THREE.Vector3(...to)]),
    [from, to],
  );
  return (
    <primitive object={new THREE.Line(geom, new THREE.LineBasicMaterial({ color: "#2dd4bf", transparent: true, opacity: 0.45 }))} />
  );
}

export function MagneticSwarm({ agents, victims }: { agents: Agent[]; victims: FusedVictim[] }) {
  const beams = useMemo(() => {
    if (!victims.length) return [];
    const primary = victims.reduce((a, b) => (a.priority >= b.priority ? a : b));
    return agents
      .filter((a) => a.status === "active")
      .slice(0, 12)
      .map((ag) => ({
        id: ag.id,
        from: [ag.position.x, ag.position.y + 0.4, ag.position.z] as [number, number, number],
        to: [primary.worldPos.x, primary.worldPos.y + 0.2, primary.worldPos.z] as [number, number, number],
      }));
  }, [agents, victims]);

  return (
    <>
      {beams.map((b) => (
        <ConvergenceBeam key={b.id} from={b.from} to={b.to} />
      ))}
    </>
  );
}
