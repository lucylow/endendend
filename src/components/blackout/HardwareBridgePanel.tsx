import { memo, useEffect, useMemo, useState } from "react";
import { Cpu, Radio, Skull, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";

type CmdRow = { id: string; kind: string; target: string; status: "queued" | "sent" | "acked" | "failed"; at: number };

export const HardwareBridgePanel = memo(function HardwareBridgePanel({
  view,
  onEmergencyStop,
}: {
  view: VertexSwarmView | null;
  onEmergencyStop: () => void | Promise<void>;
}) {
  const [rosOk, setRosOk] = useState(true);
  const [hb, setHb] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [queue, setQueue] = useState<CmdRow[]>([]);

  const lastCmd = useMemo(() => queue[queue.length - 1], [queue]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setHb((n) => n + 1);
      setRosOk((o) => {
        const next = Math.random() > 0.04 ? true : o;
        if (!next) setLog((l) => [`${new Date().toLocaleTimeString()} — ROS2 master unreachable (sim)`, ...l].slice(0, 80));
        return next;
      });
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!view) return;
    const row: CmdRow = {
      id: `cmd-${view.tickCount}`,
      kind: "velocity_setpoint",
      target: view.operatorNodeId,
      status: "acked",
      at: view.nowMs,
    };
    setQueue((q) => [row, ...q].slice(0, 12));
    if (view.tickCount % 5 === 0) {
      setLog((l) => [`${new Date().toLocaleTimeString()} — CMD_VEL → ${view.operatorNodeId} (mock bridge)`, ...l].slice(0, 80));
    }
  }, [view?.tickCount, view?.nowMs, view?.operatorNodeId, view]);

  return (
    <Card variant="node" className="border-zinc-800" data-tour="hardware">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" aria-hidden />
          Hardware bridge (ROS2 / PX4)
        </CardTitle>
        <CardDescription className="text-xs">Synthetic health until a live MAVROS session is bridged.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="flex flex-wrap gap-2">
          <Badge variant={rosOk ? "default" : "destructive"} className="font-mono text-[10px] gap-1">
            <Radio className="w-3 h-3" aria-hidden />
            ROS2 {rosOk ? "connected" : "down"}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono">
            PX4 HB {hb}
          </Badge>
          <Badge variant="secondary" className="text-[10px] font-mono">
            Last: {lastCmd?.status ?? "—"} · {lastCmd?.kind ?? "—"}
          </Badge>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Command queue</p>
          <ul className="space-y-1 font-mono text-[10px] text-muted-foreground">
            {queue.map((c) => (
              <li key={c.id} className="flex justify-between gap-2 border-b border-zinc-800/60 py-0.5">
                <span>{c.kind}</span>
                <span className="text-foreground/90">{c.target}</span>
                <span>{c.status}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1">
            <Terminal className="w-3 h-3" aria-hidden />
            Bridge log
          </p>
          <ScrollArea className="h-[120px] rounded-md border border-zinc-800/80 bg-zinc-950/50 p-2 font-mono text-[10px] text-muted-foreground">
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </ScrollArea>
        </div>
        <Button
          type="button"
          variant="destructive"
          className="w-full min-h-12 gap-2 text-sm font-semibold"
          onClick={() => void onEmergencyStop()}
        >
          <Skull className="w-4 h-4" aria-hidden />
          E-STOP hardware (bypass swarm)
        </Button>
      </CardContent>
    </Card>
  );
});
