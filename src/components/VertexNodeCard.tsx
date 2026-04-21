import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { SwarmAgentNode } from "@/backend/vertex/swarm-types";
import type { LocalAutonomyDirective } from "@/backend/vertex/fallback-coordinator";
import type { SimTelemetrySample } from "@/backend/vertex/swarm-types";

type Props = {
  node: SwarmAgentNode;
  telemetry?: SimTelemetrySample;
  autonomy?: LocalAutonomyDirective;
};

export function VertexNodeCard({ node, telemetry, autonomy }: Props) {
  const bat = telemetry ? `${Math.round(telemetry.battery01 * 100)}%` : "—";
  const link = telemetry ? `${Math.round(telemetry.link01 * 100)}%` : "—";
  return (
    <Card className="border-border/60 bg-card/40">
      <CardHeader className="py-3 px-4 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm text-foreground truncate">{node.displayName}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {node.role}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono truncate">
          {node.vendorId} · {node.model}
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0 text-xs text-muted-foreground space-y-1">
        <div className="flex flex-wrap gap-1">
          {node.capabilities.sensors.slice(0, 4).map((s) => (
            <Badge key={s} variant="secondary" className="text-[9px] font-normal">
              {s}
            </Badge>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-2 font-mono text-[10px]">
          <span>Battery {bat}</span>
          <span>Link {link}</span>
        </div>
        {autonomy && (
          <p className="text-[10px] text-primary/90 border-t border-border/40 pt-1 mt-1">
            {autonomy.action}
            {autonomy.safeOffline ? " · safe offline" : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
