import { useEffect } from "react";
import { useSwarmStore } from "@/stores/swarmStore";

const WS_PORT = 8765;

export default function WebotsBridge() {
  const connectWebots = useSwarmStore((s) => s.connectWebots);
  const disconnectWebots = useSwarmStore((s) => s.disconnectWebots);
  const wsConnected = useSwarmStore((s) => s.wsConnected);
  const lastError = useSwarmStore((s) => s.lastError);

  useEffect(() => {
    connectWebots(WS_PORT);
    return () => disconnectWebots();
  }, [connectWebots, disconnectWebots]);

  return (
    <div className="fixed right-4 top-4 z-50 max-w-sm rounded-lg border border-border bg-background/95 p-4 text-sm text-foreground shadow-xl backdrop-blur">
      <div className="font-semibold">Webots stream</div>
      <div className="mt-1 text-muted-foreground">
        {wsConnected ? (
          <span className="text-emerald-500">Live — ws://127.0.0.1:{WS_PORT}</span>
        ) : (
          <span className="text-amber-500">Disconnected — start controller on {WS_PORT}</span>
        )}
      </div>
      {lastError ? <div className="mt-2 font-mono text-xs text-destructive">{lastError}</div> : null}
      <div className="mt-2 font-mono text-[11px] text-muted-foreground">
        Example: <code className="rounded bg-muted px-1">webots worlds/fallen_comrade.wbt</code>
      </div>
    </div>
  );
}
