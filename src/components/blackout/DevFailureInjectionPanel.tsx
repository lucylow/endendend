import { memo, useState } from "react";
import type { SwarmAgentNode } from "@/backend/vertex/swarm-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInjection } from "@/hooks/useInjection";
import { Badge } from "@/components/ui/badge";

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
  meshInjectPacketLoss?: (delta01: number) => void;
  meshInjectLatency?: (deltaMs: number) => void;
  meshResetStress?: () => void;
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
  meshInjectPacketLoss,
  meshInjectLatency,
  meshResetStress,
}: Props) {
  const injection = useInjection();
  const [lossPct, setLossPct] = useState(30);
  const [latencyMs, setLatencyMs] = useState(200);
  const [killPick, setKillPick] = useState<string>(nodes[0]?.nodeId ?? "");

  const applyLoss = () => {
    if (injection.httpEnabled) void injection.setPacketLossPct(lossPct);
    else meshInjectPacketLoss?.(Math.min(0.99, lossPct / 100));
  };

  const applyLatency = () => {
    if (injection.httpEnabled) void injection.setLatencyMs(latencyMs);
    else meshInjectLatency?.(latencyMs);
  };

  const partition = () => {
    if (injection.httpEnabled) void injection.simulatePartition();
    else onPartitionPreset();
  };

  const resetAll = () => {
    if (injection.httpEnabled) void injection.resetAll();
    meshResetStress?.();
  };

  return (
    <Card className="border-dashed border-amber-500/40 bg-amber-500/[0.04]" data-tour="dev-control">
      <CardHeader className="py-3">
        <CardTitle className="text-sm text-amber-200/90">Control · failure injection</CardTitle>
        <CardDescription className="text-xs">
          Local simulator hooks by default. When ``VITE_INJECTION_API_BASE`` is set, POSTs mirror ``demo/injection_ui.py``
          endpoints (`/inject/kill/`, `/stress/packet_loss/`, …).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-800/80 bg-zinc-950/50 px-3 py-2 text-[11px] text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Badge variant="outline" className="font-mono text-[10px]">
            {injection.httpEnabled ? "HTTP injection" : "Local mesh"}
          </Badge>
          {injection.busy ? <span>Applying…</span> : null}
          {injection.lastAction ? <span className="text-foreground">{injection.lastAction}</span> : null}
          {injection.error ? <span className="text-destructive">{injection.error}</span> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-zinc-800/80 p-3">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-500">Packet loss (all links)</Label>
            <div className="flex items-center justify-between text-xs font-mono">
              <span>{lossPct}%</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[lossPct]}
              onValueChange={(v) => setLossPct(v[0] ?? 0)}
              aria-label="Inject packet loss percent"
            />
            <Button type="button" size="sm" variant="secondary" className="w-full min-h-11 text-xs" onClick={applyLoss}>
              Apply loss
            </Button>
          </div>
          <div className="space-y-3 rounded-lg border border-zinc-800/80 p-3">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-500">Extra latency</Label>
            <div className="flex items-center justify-between text-xs font-mono">
              <span>{latencyMs} ms</span>
            </div>
            <Slider
              min={0}
              max={1000}
              step={10}
              value={[latencyMs]}
              onValueChange={(v) => setLatencyMs(v[0] ?? 0)}
              aria-label="Inject additional latency milliseconds"
            />
            <Button type="button" size="sm" variant="secondary" className="w-full min-h-11 text-xs" onClick={applyLatency}>
              Apply latency
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <div className="min-w-[200px] flex-1 space-y-2">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-500">Kill drone</Label>
            <Select value={killPick} onValueChange={setKillPick}>
              <SelectTrigger className="min-h-11 font-mono text-xs" aria-label="Select drone to kill">
                <SelectValue placeholder="Pick drone" />
              </SelectTrigger>
              <SelectContent>
                {nodes.map((n) => (
                  <SelectItem key={n.nodeId} value={n.nodeId}>
                    {n.nodeId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            disabled={!killPick}
            onClick={() => {
              if (injection.httpEnabled) void injection.killDrone(killPick);
              else onKill(killPick);
            }}
            aria-label="Kill selected drone"
          >
            Kill
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={!killPick}
            onClick={() => {
              if (injection.httpEnabled) void injection.restoreDrone(killPick);
              else onRestore(killPick);
            }}
            aria-label="Restore selected drone"
          >
            Restore
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Per drone (quick)</p>
          <div className="flex flex-col gap-2">
            {nodes.map((n) => (
              <div key={n.nodeId} className="flex flex-wrap gap-2 items-center rounded-md border border-zinc-800/80 bg-zinc-950/40 px-2 py-2">
                <span className="text-[10px] font-mono text-foreground w-28 shrink-0">{n.nodeId}</span>
                <Button type="button" size="sm" variant="destructive" className="min-h-11 text-[10px]" onClick={() => onKill(n.nodeId)} aria-label={`Kill ${n.nodeId}`}>
                  Kill
                </Button>
                <Button type="button" size="sm" variant="outline" className="min-h-11 text-[10px]" onClick={() => onRestore(n.nodeId)} aria-label={`Restore ${n.nodeId}`}>
                  Restore
                </Button>
                <Button type="button" size="sm" variant="secondary" className="min-h-11 text-[10px]" onClick={() => onLoss(n.nodeId)} aria-label={`Packet loss for ${n.nodeId}`}>
                  50% loss
                </Button>
                <Button type="button" size="sm" variant="ghost" className="min-h-11 text-[10px]" onClick={() => onDelay(n.nodeId)} aria-label={`Latency for ${n.nodeId}`}>
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
            <Button type="button" variant="outline" size="sm" className="min-h-11 text-xs" onClick={partition} aria-label="Simulate network partition">
              Partition
            </Button>
            <Button type="button" variant="ghost" size="sm" className="min-h-11 text-xs" onClick={resetAll} aria-label="Reset injected faults">
              Reset all
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
