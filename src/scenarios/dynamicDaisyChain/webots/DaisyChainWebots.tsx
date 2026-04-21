import { Button } from "@/components/ui/button";
import { useSwarmStore } from "@/stores/swarmStore";

export function DaisyChainWebotsPanel() {
  const connectWebots = useSwarmStore((s) => s.connectWebots);
  const disconnectWebots = useSwarmStore((s) => s.disconnectWebots);
  const wsConnected = useSwarmStore((s) => s.wsConnected);
  const lastError = useSwarmStore((s) => s.lastError);

  return (
    <div className="space-y-1 rounded border border-cyan-500/25 bg-cyan-950/20 p-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-cyan-200/90">Production Webots</div>
      <p className="text-[10px] leading-snug text-slate-400">
        Open <span className="font-mono text-slate-200">worlds/dynamic_daisy_chain.wbt</span> then bridge 60 Hz telemetry (
        <span className="font-mono">dynamic_daisy_emitter</span>).
      </p>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="secondary" className="h-7 text-[10px]" onClick={() => connectWebots(8765)}>
          Connect ws :8765
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => disconnectWebots()}>
          Disconnect
        </Button>
      </div>
      <div className="text-[9px] text-slate-500">
        Enable &quot;Prefer live WS&quot; in mock controls so the engine does not overwrite Track2 fields while connected.
      </div>
      {lastError ? <div className="text-[9px] text-red-300/90">{lastError}</div> : null}
      {wsConnected ? <div className="text-[9px] text-emerald-300/90">Streaming…</div> : null}
    </div>
  );
}
