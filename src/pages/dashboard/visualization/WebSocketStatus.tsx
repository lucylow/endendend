import { Badge } from "@/components/ui/badge";
import { useSwarmStore } from "@/store/swarmStore";
import { Activity, Wifi, WifiOff } from "lucide-react";

/**
 * Connection indicator for the swarm telemetry WebSocket (metrics come from {@link useSwarmRealtime} on the viz page).
 */
export function WebSocketStatus() {
  const { connectionStatus, latencyMs, messagesPerSec, telemetryPeerUrls, telemetryPeersConnected, telemetryMergeConflict } =
    useSwarmStore((s) => s.swarmWs);
  const lastEdge = useSwarmStore((s) => s.edgeLatencyEvents[0]);
  const multi = telemetryPeerUrls.length > 1;

  const config =
    connectionStatus === "connected"
      ? {
          variant: "default" as const,
          icon: Wifi,
          label: multi
            ? `Live ${telemetryPeersConnected}/${telemetryPeerUrls.length} peers (${latencyMs.toFixed(0)}ms)`
            : `Live stream (${latencyMs.toFixed(0)}ms)`,
          color: "bg-emerald-500/20 border-emerald-500/50 text-emerald-400",
        }
      : connectionStatus === "connecting"
        ? {
            variant: "secondary" as const,
            icon: Activity,
            label: "Connecting…",
            color: "bg-yellow-500/20 border-yellow-500/50 text-yellow-400",
          }
        : {
            variant: "destructive" as const,
            icon: WifiOff,
            label: "Stream offline",
            color: "bg-red-500/20 border-red-500/50 text-red-400",
          };

  const Icon = config.icon;

  return (
    <div className="absolute right-6 top-6 z-50 sm:right-8">
      <Badge className={`flex items-center gap-2 shadow-lg ${config.color}`} variant={config.variant}>
        <Icon className="h-4 w-4" />
        {config.label}
        {connectionStatus === "connected" && (
          <span className="ml-1 rounded bg-black/50 px-1.5 py-0.5 font-mono text-xs">
            {messagesPerSec.toFixed(0)} msg/s
            {lastEdge != null && (
              <span className="ml-1 text-cyan-300" title={`${lastEdge.operation} edge path`}>
                {lastEdge.operation}: {lastEdge.latencyMs.toFixed(0)}ms
              </span>
            )}
            {telemetryMergeConflict && (
              <span className="ml-1 text-amber-400" title="Peers disagree on roles at similar timestamps">
                ⚠
              </span>
            )}
          </span>
        )}
      </Badge>
    </div>
  );
}
