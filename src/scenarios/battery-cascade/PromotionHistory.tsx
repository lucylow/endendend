import { useBatteryCascadeStore } from "./batteryCascadeStore";

export default function PromotionHistory() {
  const log = useBatteryCascadeStore((s) => s.promotionLog);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Promotion history</h3>
      {log.length === 0 ? (
        <p className="text-xs text-zinc-500 leading-relaxed">Standby promotions appear here after heartbeat consensus.</p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
          {log.map((e, i) => (
            <li
              key={`${e.agentId}-${e.at}-${i}`}
              className="rounded-md border border-violet-500/20 bg-violet-950/20 px-2 py-1.5 font-mono text-violet-200/90"
            >
              <span className="text-zinc-400">{new Date(e.at).toLocaleTimeString()}</span> · {e.name}{" "}
              <span className="text-zinc-500">({e.reason})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
