import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useSwarmRuntime } from "@/hooks/useSwarmRuntime";

export function SwarmNodePanel() {
  const { normalized } = useSwarmRuntime();
  const peers = normalized?.peers ?? [];
  const [id, setId] = useState("");
  const effectiveId = id && peers.some((x) => x.peerId === id) ? id : (peers[0]?.peerId ?? "");
  const p = peers.find((x) => x.peerId === effectiveId) ?? peers[0];
  if (!p) {
    return (
      <Card className="border-border/60 bg-card/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Peer profile</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">No peers yet.</CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-border/60 bg-card/30">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Peer profile (P2P)</CardTitle>
        <Select value={effectiveId} onValueChange={setId}>
          <SelectTrigger className="h-8 text-xs mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {peers.map((n) => (
              <SelectItem key={n.peerId} value={n.peerId} className="text-xs">
                {n.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-[10px]">
            {p.nodeTypeLabel}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            role {p.role}
          </Badge>
          {p.offline && (
            <Badge variant="destructive" className="text-[10px]">
              offline
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground space-y-1 font-mono text-[10px]">
          <div>vendor {p.vendorFamily}</div>
          <div>mobility {p.mobility}</div>
          <div>trust {(p.trust01 * 100).toFixed(0)}% · bat {(p.battery01 * 100).toFixed(0)}%</div>
          <div>link {(p.linkQuality01 * 100).toFixed(0)}% · queue {p.queueDepth}</div>
          <div>command-reachable {p.partitionReachableToOperator ? "yes" : "no"}</div>
          {p.relayAssistPeer && <div className="text-primary/90">relay assist → {p.relayAssistPeer}</div>}
          <div>recovery {p.recoveryState}</div>
          <div>autonomy {p.localAutonomy}</div>
          <div className="text-foreground/80">{p.rangeOrEndurance}</div>
          <div>sensors {p.sensors.join(", ") || "—"}</div>
        </div>
      </CardContent>
    </Card>
  );
}
