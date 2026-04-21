import { Badge } from "@/components/ui/badge";
import { useRuntimeState } from "@/hooks/useRuntimeState";
import { selectIsConnected, selectIsDemoMode } from "@/lib/state/selectors";

export function ConnectionStatus() {
  const { connection, transport, flatEnvelope, lastSwarmSnapshot } = useRuntimeState();
  const mesh = lastSwarmSnapshot?.tashi?.mesh;
  const demo = selectIsDemoMode(transport, flatEnvelope.source);
  const connected = selectIsConnected(connection);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant={connected ? "default" : "secondary"}>
        HTTP {connection.httpReachable ? "up" : "down"}
      </Badge>
      <Badge variant={connection.wsConnected ? "default" : "outline"}>
        WS {connection.realtimeStatus === "ws_open" ? "live" : connection.pollActive ? "poll" : connection.realtimeStatus}
      </Badge>
      <Badge variant="outline" className="font-mono">
        transport:{transport}
      </Badge>
      <Badge variant={demo ? "destructive" : "secondary"}>{demo ? "demo / fallback data" : "engine data"}</Badge>
      {flatEnvelope.source !== "local_engine" && (
        <Badge variant="outline">source:{flatEnvelope.source}</Badge>
      )}
      {mesh?.nodeId != null && (
        <span className="text-zinc-500">
          mesh:{String(mesh.nodeId)} {mesh.role != null ? `· ${String(mesh.role)}` : ""}
        </span>
      )}
      {connection.lastSyncAtMs != null && (
        <span className="text-zinc-500">sync {new Date(connection.lastSyncAtMs).toLocaleTimeString()}</span>
      )}
      {connection.lastError && <span className="text-amber-400 max-w-[200px] truncate">{connection.lastError}</span>}
    </div>
  );
}
