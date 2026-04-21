import { memo } from "react";
import { SwarmMap } from "@/components/SwarmMap";
import type { FlatMissionEnvelope } from "@/lib/state/types";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { readPersistedEnvelope } from "@/hooks/usePersistedEnvelope";

export const BlackoutMobileCompanion = memo(function BlackoutMobileCompanion({
  view,
  envelope,
  offline,
}: {
  view: VertexSwarmView | null;
  envelope: FlatMissionEnvelope;
  offline: boolean;
}) {
  const cached = offline ? readPersistedEnvelope() : null;
  const env = cached ?? envelope;

  return (
    <div className="space-y-4 md:hidden pb-8" data-tour="mobile">
      {offline ? (
        <p className="text-xs text-amber-300/90 border border-amber-500/30 rounded-lg px-3 py-2" role="status">
          Offline — showing last cached envelope {cached ? `(${cached.missionId})` : "(none)"}.
        </p>
      ) : null}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Fleet summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{env.nodes.length} nodes</Badge>
            <Badge variant="secondary">{env.phase}</Badge>
            <Badge variant="outline">{env.mapSummary.coveragePercent}% cov</Badge>
          </div>
          <ul className="text-sm space-y-1">
            {env.nodes.slice(0, 5).map((n) => (
              <li key={n.nodeId} className="flex justify-between gap-2 font-mono text-xs border-b border-border/30 py-1">
                <span>{n.nodeId}</span>
                <span className="text-muted-foreground">{(n.battery * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Active alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {env.alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No alerts.</p>
          ) : (
            env.alerts.map((a, i) => (
              <div key={i} className="rounded-lg border border-zinc-800 px-3 py-2 text-xs">
                <span className="font-semibold">{a.type}</span>
                <p className="text-muted-foreground mt-1">{a.message}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">2D map (mobile)</CardTitle>
        </CardHeader>
        <CardContent>
          <SwarmMap view={view} scenario={view?.scenario} />
        </CardContent>
      </Card>
    </div>
  );
});
