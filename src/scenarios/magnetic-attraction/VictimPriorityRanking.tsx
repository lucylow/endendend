import { useMagneticAttractionStore } from "./magneticAttractionStore";

export default function VictimPriorityRanking() {
  const victims = useMagneticAttractionStore((s) => [...s.victims].sort((a, b) => b.value - a.value));

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-zinc-300">Stake-weighted ranking</h4>
      <ol className="space-y-1.5 text-xs text-zinc-400">
        {victims.map((v, i) => (
          <li key={v.id} className="flex items-center justify-between rounded-md border border-zinc-800/60 bg-zinc-900/40 px-2 py-1.5">
            <span className="font-mono text-zinc-500">{i + 1}.</span>
            <span style={{ color: v.color }} className="font-bold">
              {v.id}
            </span>
            <span className="tabular-nums">{v.value.toFixed(2)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
