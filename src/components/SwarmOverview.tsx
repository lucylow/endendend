import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";

export function SwarmOverview({ view }: { view: VertexSwarmView | null }) {
  if (!view) {
    return (
      <Card className="border-border/60 bg-card/20">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Swarm overview</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">…</CardContent>
      </Card>
    );
  }
  const online = view.nodes.filter((n) => !n.offline).length;
  const confirmed = view.discovery.filter((d) => d.status === "confirmed").length;
  return (
    <Card className="border-border/60 bg-card/20">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Swarm overview</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary" className="font-mono text-[10px]">
          {online}/{view.nodes.length} active
        </Badge>
        <Badge variant="outline" className="font-mono text-[10px]">
          {(view.sharedMap.coverage01 * 100).toFixed(0)}% coverage
        </Badge>
        <Badge variant="outline" className="font-mono text-[10px]">
          {view.discovery.length} detections
        </Badge>
        <Badge variant="outline" className="font-mono text-[10px]">
          {confirmed} confirmed
        </Badge>
        <Badge variant="outline" className="font-mono text-[10px]">
          {view.tasks.filter((t) => t.status === "assigned" || t.status === "bidding").length} open tasks
        </Badge>
        <Badge variant={view.blackoutActive ? "destructive" : "secondary"} className="font-mono text-[10px]">
          {view.connectivityMode}
        </Badge>
      </CardContent>
    </Card>
  );
}
