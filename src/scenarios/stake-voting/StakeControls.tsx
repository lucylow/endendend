import { Pause, Play, RotateCcw, Scale3D, Equal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStakeVotingStore } from "./stakeVotingStore";

export default function StakeControls() {
  const simRunning = useStakeVotingStore((s) => s.simRunning);
  const setSimRunning = useStakeVotingStore((s) => s.setSimRunning);
  const reset = useStakeVotingStore((s) => s.reset);
  const boost = useStakeVotingStore((s) => s.boostOptimalStakes);
  const equalize = useStakeVotingStore((s) => s.equalizeStakes);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className="gap-1.5 border-zinc-600 text-xs" onClick={() => setSimRunning(!simRunning)}>
        {simRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {simRunning ? "Pause" : "Run"}
      </Button>
      <Button variant="secondary" size="sm" className="gap-1.5 text-xs" onClick={boost}>
        <Scale3D className="h-3.5 w-3.5" />
        Boost optimal stake
      </Button>
      <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-zinc-400" onClick={equalize}>
        <Equal className="h-3.5 w-3.5" />
        Equal stakes
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5 border-zinc-600 text-xs" onClick={reset}>
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </Button>
    </div>
  );
}
