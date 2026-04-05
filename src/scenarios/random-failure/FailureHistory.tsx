import { useRandomFailureStore } from "./randomFailureStore";

export default function FailureHistory() {
  const failureLog = useRandomFailureStore((s) => s.failureLog);

  if (failureLog.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 text-xs text-zinc-500">
        No failures yet — first random kill after ~30s sim time.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Failure history</h4>
      <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs text-zinc-300">
        {failureLog.map((e) => (
          <li key={`${e.agentId}-${e.at}`} className="flex justify-between gap-2 border-b border-zinc-800/50 pb-1.5 last:border-0">
            <span className="font-mono text-amber-400/90">{e.name}</span>
            <span className="text-zinc-500">t={e.at.toFixed(1)}s</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
