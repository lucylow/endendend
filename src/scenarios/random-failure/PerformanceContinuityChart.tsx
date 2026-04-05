import { useRandomFailureStore } from "./randomFailureStore";

export default function PerformanceContinuityChart() {
  const uptimeHistory = useRandomFailureStore((s) => s.uptimeHistory);
  const max = Math.max(100, ...uptimeHistory);
  const min = Math.min(...uptimeHistory);
  const span = Math.max(0.5, max - min);

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Performance continuity</h4>
      <p className="mt-1 text-[11px] text-zinc-500">Sampled uptime % every ~2s</p>
      <div className="mt-3 flex h-24 items-end gap-0.5">
        {uptimeHistory.map((u, i) => {
          const h = ((u - min) / span) * 100;
          return (
            <div
              key={i}
              className="min-w-0 flex-1 rounded-t bg-gradient-to-t from-emerald-900/80 to-emerald-400/90"
              style={{ height: `${Math.max(8, Math.min(100, h))}%` }}
              title={`${u.toFixed(1)}%`}
            />
          );
        })}
      </div>
    </div>
  );
}
