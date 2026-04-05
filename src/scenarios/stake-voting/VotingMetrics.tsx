import { Vote } from "lucide-react";
import { useStakeVotingStore } from "./stakeVotingStore";

function StakeInfluenceRow({ label, stake, influence }: { label: string; stake: number; influence: string }) {
  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2">
      <div className="text-[10px] font-mono uppercase text-zinc-500">{label}</div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-sm font-bold text-violet-300">stake {(stake * 100).toFixed(0)}%</span>
        <span className="text-xs text-emerald-400/90">{influence}</span>
      </div>
    </div>
  );
}

export default function VotingMetrics() {
  const optimalChoiceRate = useStakeVotingStore((s) => s.optimalChoiceRate);
  const democraticRate = useStakeVotingStore((s) => s.democraticRate);

  const smarter =
    democraticRate > 0.5 ? (((optimalChoiceRate - democraticRate) / democraticRate) * 100).toFixed(0) : "—";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-purple-500/35 bg-zinc-900/40 p-5 shadow-xl backdrop-blur-sm">
        <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-purple-300">
          <Vote className="h-5 w-5 shrink-0" />
          Governance intelligence
        </h3>

        <div className="grid grid-cols-2 gap-6 text-center">
          <div>
            <div className="text-3xl font-black text-purple-400 sm:text-4xl">{optimalChoiceRate.toFixed(0)}%</div>
            <div className="mt-1 text-xs text-zinc-500">Stake-weighted (replay)</div>
          </div>
          <div>
            <div className="text-3xl font-black text-zinc-500 sm:text-4xl">{democraticRate.toFixed(0)}%</div>
            <div className="mt-1 text-xs text-zinc-500">Head-count baseline</div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/15 to-emerald-500/15 p-4">
          <div className="text-lg font-black text-purple-300 sm:text-xl">{smarter}% lift vs baseline</div>
          <div className="mt-1 text-xs text-purple-200/80">Economic weight aligns votes with the shorter path.</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StakeInfluenceRow label="High stake · optimal" stake={0.85} influence="tips B" />
        <StakeInfluenceRow label="High stake · risky" stake={0.72} influence="minority $A" />
        <StakeInfluenceRow label="Low stake · optimal" stake={0.12} influence="voice" />
        <StakeInfluenceRow label="Low stake · risky" stake={0.08} influence="voice" />
      </div>
    </div>
  );
}
