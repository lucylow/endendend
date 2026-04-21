import { memo } from "react";
import type { SwarmAgentNode } from "@/backend/vertex/swarm-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  nodes: SwarmAgentNode[];
  onKill: (id: string) => void;
  onRestore: (id: string) => void;
  onLoss: (id: string) => void;
  onDelay: (id: string) => void;
  onKillAllRelays: () => void;
  onBurstLoss: () => void;
  onTunnelPreset: () => void;
  onPartitionPreset: () => void;
};

export const DevFailureInjectionPanel = memo(function DevFailureInjectionPanel({
  nodes,
  onKill,
  onRestore,
  onLoss,
  onDelay,
  onKillAllRelays,
  onBurstLoss,
  onTunnelPreset,
  onPartitionPreset,
}: Props) {
  return (
    <Card className="border-dashed border-amber-500/40 bg-amber-500/[0.04]" data-tour="dev-control">
      <CardHeader className="py-3">
        <CardTitle className="text-sm text-amber-200/90">Control · failure injection</CardTitle>
        <CardDescription className="text-xs">
          Dev-only surface mirroring ``demo/injection_ui.py`` — per-drone faults, batch stress, presets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Per drone</p>
          <div className="flex flex-col gap-2">
            {nodes.map((n) => (
              <div key={n.nodeId} className="flex flex-wrap gap-2 items-center rounded-md border border-zinc-800/80 bg-zinc-950/40 px-2 py-2">
                <span className="text-[10px] font-mono text-foreground w-28 shrink-0">{n.nodeId}</span>
                <Button type="button" size="sm" variant="destructive" className="min-h-11 text-[10px]" onClick={() => onKill(n.nodeId)}>
                  Kill
                </Button>
                <Button type="button" size="sm" variant="outline" className="min-h-11 text-[10px]" onClick={() => onRestore(n.nodeId)}>
                  Restore
                </Button>
                <Button type="button" size="sm" variant="secondary" className="min-h-11 text-[10px]" onClick={() => onLoss(n.nodeId)}>
                  50% loss
                </Button>
                <Button type="button" size="sm" variant="ghost" className="min-h-11 text-[10px]" onClick={() => onDelay(n.nodeId)}>
                  +200 ms
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Batch</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="min-h-11 text-xs" onClick={onKillAllRelays}>
              Kill all relays
            </Button>
            <Button type="button" variant="outline" size="sm" className="min-h-11 text-xs" onClick={onBurstLoss}>
              Burst loss (all links)
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Scenario presets</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" className="min-h-11 text-xs" onClick={onTunnelPreset}>
              Tunnel @ 90 m
            </Button>
            <Button type="button" variant="secondary" size="sm" className="min-h-11 text-xs" onClick={onPartitionPreset}>
              Partition A/B
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
