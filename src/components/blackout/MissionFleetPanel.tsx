import { memo, useCallback, useState } from "react";
import { Activity, Crosshair, HeartPulse, Radio, Stethoscope } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SwarmAgentNode } from "@/backend/vertex/swarm-types";
import type { SimTelemetrySample } from "@/backend/vertex/swarm-types";
import type { LocalAutonomyDirective } from "@/backend/vertex/fallback-coordinator";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { colors } from "@/lib/design-tokens";

const ROLE_ICON: Record<string, LucideIcon> = {
  explorer: Crosshair,
  scout: Crosshair,
  relay: Radio,
  standby: Activity,
  triage: Stethoscope,
  medic: HeartPulse,
  carrier: Radio,
  observer: Activity,
  coordinator: Radio,
  transport: Radio,
};

function roleIcon(role: string): LucideIcon {
  const k = role.toLowerCase();
  for (const [key, Icon] of Object.entries(ROLE_ICON)) {
    if (k.includes(key)) return Icon;
  }
  return Crosshair;
}

function healthDotClass(node: SwarmAgentNode, telemetry: SimTelemetrySample | undefined, nowMs: number): string {
  if (node.offline) return "bg-red-500";
  const hb = node.lastHeartbeatMs ?? nowMs;
  if (nowMs - hb > 8_000) return "bg-red-500";
  if (nowMs - hb > 2_500) return "bg-amber-400";
  if (telemetry && telemetry.link01 < 0.35) return "bg-amber-400";
  return "bg-emerald-500";
}

function healthLabel(node: SwarmAgentNode, telemetry: SimTelemetrySample | undefined, nowMs: number): string {
  if (node.offline) return "Isolated / offline";
  const hb = node.lastHeartbeatMs ?? nowMs;
  if (nowMs - hb > 8_000) return "Stale heartbeat";
  if (nowMs - hb > 2_500) return "Syncing";
  if (telemetry && telemetry.link01 < 0.35) return "Degraded link";
  return "Online";
}

type FleetCardProps = {
  node: SwarmAgentNode;
  telemetry?: SimTelemetrySample;
  autonomy?: LocalAutonomyDirective;
  nowMs: number;
};

const FleetPrimaryDroneCardInner = ({ node, telemetry, autonomy, nowMs }: FleetCardProps) => {
  const [open, setOpen] = useState(false);
  const batPct = telemetry ? Math.round(telemetry.battery01 * 100) : null;
  const trust = Math.round(node.trust01 * 100);
  const hbAge = Math.max(0, nowMs - (node.lastHeartbeatMs ?? nowMs));
  const Icon = roleIcon(node.role);
  const dotClass = healthDotClass(node, telemetry, nowMs);
  const taskLabel =
    autonomy?.action?.slice(0, 48) ?? (node.currentTaskId ? `Task ${node.currentTaskId}` : "Idle / holding");

  const onOpen = useCallback(() => setOpen(true), []);

  return (
    <>
      <Card
        variant="node"
        className="cursor-pointer hover:border-sky-500/40 transition-colors min-h-[140px]"
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Inspect drone ${node.displayName}`}
      >
        <CardHeader className="py-3 px-3 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="h-4 w-4 shrink-0 text-sky-400" aria-hidden />
              <span className="font-medium text-sm text-foreground truncate">{node.displayName}</span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="relative flex h-2.5 w-2.5 shrink-0 mt-1">
                    <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping", dotClass)} />
                    <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", dotClass)} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[220px] text-xs">
                  {healthLabel(node, telemetry, nowMs)}
                  {autonomy?.safeOffline ? " · Safe-offline path armed" : ""}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Badge variant="outline" className="text-[10px] w-fit border-sky-500/40 text-sky-200/90">
            {node.role}
          </Badge>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0 space-y-3">
          <div className="flex items-center gap-3">
            <BatteryRing pct={batPct} />
            <div className="flex-1 space-y-1 min-w-0">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>Trust</span>
                <span>{trust}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full rounded-full bg-sky-500/90" style={{ width: `${trust}%` }} />
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">{taskLabel}</p>
          <p className="text-[10px] font-mono text-zinc-500">HB Δ {hbAge} ms</p>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-[min(100vw,380px)] sm:max-w-md border-zinc-800 bg-zinc-950">
          <SheetHeader>
            <SheetTitle className="text-base">{node.displayName}</SheetTitle>
            <p className="text-xs font-mono text-muted-foreground">{node.nodeId}</p>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-8rem)] mt-4 pr-3">
            <div className="space-y-4 text-xs">
              <section>
                <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Telemetry</h4>
                <pre className="rounded-md border border-zinc-800 bg-zinc-900/80 p-2 font-mono text-[10px] text-zinc-300 overflow-x-auto">
                  {JSON.stringify(
                    telemetry ?? { note: "No sample yet for this tick" },
                    null,
                    2,
                  )}
                </pre>
              </section>
              <section>
                <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Trust trend (recent)</h4>
                <div className="flex gap-1 h-12 items-end">
                  {[0.92, 0.9, 0.88, node.trust01, node.trust01 * 0.99].map((v, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-sky-500/70"
                      style={{ height: `${Math.max(8, v * 100)}%` }}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Synthetic preview — live series from ledger export.</p>
              </section>
              <section>
                <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Proof hints</h4>
                <p className="font-mono text-[10px] text-zinc-400 break-all">
                  {node.vendorId}::{node.model}
                </p>
              </section>
            </div>
          </ScrollArea>
          <Button variant="outline" className="mt-4 w-full min-h-11" onClick={() => setOpen(false)} type="button">
            Close
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
};

export const FleetPrimaryDroneCard = memo(FleetPrimaryDroneCardInner);

function BatteryRing({ pct }: { pct: number | null }) {
  const p = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;
  return (
    <div className="relative h-12 w-12 shrink-0" style={{ color: colors.primary }} aria-label={pct == null ? "Battery unknown" : `Battery ${pct}%`}>
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" className="stroke-zinc-800" strokeWidth="5" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-foreground">
        {pct == null ? "—" : `${pct}`}
      </span>
    </div>
  );
}

type PanelProps = {
  nodes: SwarmAgentNode[];
  telemetry: SimTelemetrySample[];
  autonomy: LocalAutonomyDirective[];
  nowMs: number;
};

export function MissionFleetPanel({ nodes, telemetry, autonomy, nowMs }: PanelProps) {
  const primary = nodes.slice(0, 5);
  return (
    <section aria-labelledby="fleet-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="fleet-heading" className="text-sm font-semibold text-foreground tracking-tight">
          Primary fleet
        </h2>
        <span className="text-[10px] font-mono text-muted-foreground">Top 5 nodes</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {primary.map((n) => (
          <FleetPrimaryDroneCard
            key={n.nodeId}
            node={n}
            telemetry={telemetry.find((t) => t.nodeId === n.nodeId)}
            autonomy={autonomy.find((a) => a.nodeId === n.nodeId)}
            nowMs={nowMs}
          />
        ))}
      </div>
    </section>
  );
}
