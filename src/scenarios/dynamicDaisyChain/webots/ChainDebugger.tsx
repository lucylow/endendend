import { useSwarmStore } from "@/stores/swarmStore";

export function ChainDebugger() {
  const relayChain = useSwarmStore((s) => s.relayChain);
  const signalQuality = useSwarmStore((s) => s.signalQuality);
  const time = useSwarmStore((s) => s.time);
  const wsConnected = useSwarmStore((s) => s.wsConnected);

  const keys = Object.keys(signalQuality).filter((k) => k.includes("->"));

  return (
    <div className="rounded border border-white/10 bg-black/45 p-2 font-mono text-[10px] text-slate-300">
      <div className="text-violet-200">Webots chain debugger</div>
      <div className="mt-1 text-slate-400">t={time.toFixed(2)}s · ws={wsConnected ? "up" : "down"}</div>
      <div className="mt-1 break-all">chain: {relayChain.length ? relayChain.join(" → ") : "—"}</div>
      <ul className="mt-1 max-h-20 list-inside list-disc overflow-auto text-[9px] text-slate-500">
        {keys.slice(0, 12).map((k) => (
          <li key={k}>
            {k}: {(signalQuality[k]! * 100).toFixed(0)}%
          </li>
        ))}
      </ul>
    </div>
  );
}
