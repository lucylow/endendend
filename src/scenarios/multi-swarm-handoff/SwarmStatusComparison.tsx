import { useScenarioVizStore } from "@/store/scenarioVizStore";

export default function SwarmStatusComparison() {
  const agentsA = useScenarioVizStore((s) => s.agentsA);
  const agentsB = useScenarioVizStore((s) => s.agentsB);
  const handoffActive = useScenarioVizStore((s) => s.handoffActive);

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <h4 className="mb-3 text-xs font-mono uppercase tracking-widest text-zinc-500">Independent swarms</h4>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3">
          <div className="font-bold text-emerald-400">Swarm A</div>
          <div className="mt-1 text-muted-foreground">Exploration / find</div>
          <div className="mt-2 font-mono text-zinc-300">{agentsA.length} agents</div>
          <div className="mt-1 text-[10px] text-zinc-500">
            {handoffActive ? "Stand down after find" : "Closing on pallet"}
          </div>
        </div>
        <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-3">
          <div className="font-bold text-blue-400">Swarm B</div>
          <div className="mt-1 text-muted-foreground">Heavy lift</div>
          <div className="mt-2 font-mono text-zinc-300">{agentsB.length} agents</div>
          <div className="mt-1 text-[10px] text-zinc-500">
            {handoffActive ? "Approach + lift ring" : "Standby at dock"}
          </div>
        </div>
      </div>
    </div>
  );
}
