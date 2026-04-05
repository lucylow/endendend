import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import type { Agent } from "@/types";
import type { FusedVictim } from "../types";
import { AttractionField3D } from "./AttractionField3D";
import { MagneticSwarm } from "./MagneticSwarm";

export function AttractionFieldScene({ victims, agents }: { victims: FusedVictim[]; agents: Agent[] }) {
  return (
    <div className="h-64 w-full overflow-hidden rounded-xl border border-teal-500/20 bg-zinc-950 sm:h-80">
      <Canvas dpr={[1, 2]}>
        <OrthographicCamera makeDefault position={[0, 48, 0]} zoom={28} near={0.1} far={200} />
        <ambientLight intensity={0.6} />
        <color attach="background" args={["#020617"]} />
        {victims.map((v) => (
          <AttractionField3D key={v.id} victim={v} />
        ))}
        <MagneticSwarm agents={agents} victims={victims} />
      </Canvas>
    </div>
  );
}
