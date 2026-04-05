import { useStakeVotingStore } from "./stakeVotingStore";

export default function VotingVisualizer() {
  const wA = useStakeVotingStore((s) => s.weightedVotesA);
  const wB = useStakeVotingStore((s) => s.weightedVotesB);
  const consensusIsOptimal = useStakeVotingStore((s) => s.consensusIsOptimal);
  const total = wA + wB || 1;
  const pctA = (wA / total) * 100;
  const pctB = (wB / total) * 100;

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Live weighted tally</h4>
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-[11px] font-mono text-zinc-300">
            <span className="text-red-400">Path A (risky)</span>
            <span>{pctA.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-red-500/80 transition-all duration-300" style={{ width: `${pctA}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[11px] font-mono text-zinc-300">
            <span className="text-emerald-400">Path B (optimal)</span>
            <span>{pctB.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-emerald-500/80 transition-all duration-300" style={{ width: `${pctB}%` }} />
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-zinc-500">
        Consensus:{" "}
        <span className={consensusIsOptimal ? "font-semibold text-emerald-400" : "font-semibold text-red-400"}>
          {consensusIsOptimal ? "Optimal (B)" : "Risky (A)"}
        </span>
      </p>
    </div>
  );
}
