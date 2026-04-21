import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRuntimeState } from "@/hooks/useRuntimeState";
import { selectRewardBalance } from "@/lib/state/selectors";

export function RewardPanel() {
  const { rewards, flatEnvelope } = useRuntimeState();
  const total = selectRewardBalance(rewards);

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Rewards / reputation</CardTitle>
        <p className="text-[11px] text-zinc-500">Pool hint Σ {total} · {flatEnvelope.source}</p>
      </CardHeader>
      <CardContent className="space-y-1 max-h-40 overflow-y-auto text-[11px]">
        {rewards.map((r) => (
          <div key={r.id} className="flex justify-between border-b border-zinc-800/60 py-1">
            <span className="font-mono text-zinc-300">{r.nodeId}</span>
            <span className="text-zinc-500">
              {r.kind} · {r.amount}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
