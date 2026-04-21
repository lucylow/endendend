import { useMemo } from "react";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import { parseCellKey } from "@/swarm/sharedMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STATE_COLORS: Record<string, string> = {
  unknown: "bg-muted/40",
  frontier: "bg-amber-500/35",
  seen: "bg-sky-500/25",
  searched: "bg-emerald-500/30",
  blocked: "bg-zinc-600/50",
  target: "bg-destructive/55",
  safe: "bg-primary/20",
  hazard: "bg-orange-600/45",
  relay_critical: "bg-violet-500/35",
  unreachable: "bg-neutral-700/55",
};

function scenarioOverlayClass(scenario?: string | null): string {
  switch (scenario) {
    case "wildfire":
      return "ring-2 ring-red-500/35 shadow-[inset_0_0_48px_rgba(239,68,68,0.12)]";
    case "flood_rescue":
      return "ring-2 ring-sky-500/35 shadow-[inset_0_0_48px_rgba(14,165,233,0.1)]";
    case "hazmat":
      return "ring-2 ring-amber-500/35 shadow-[inset_0_0_48px_rgba(245,158,11,0.1)]";
    case "tunnel":
      return "ring-2 ring-emerald-500/35 shadow-[inset_0_0_48px_rgba(16,185,129,0.08)]";
    case "collapsed_building":
      return "ring-2 ring-orange-500/30 shadow-[inset_0_0_40px_rgba(249,115,22,0.1)]";
    default:
      return "";
  }
}

type Props = { view: VertexSwarmView | null; scenario?: string | null };

export function SwarmMap({ view, scenario }: Props) {
  const { grid, agents, bounds } = useMemo(() => {
    if (!view) return { grid: [] as string[][], agents: [] as { gx: number; gz: number; id: string }[], bounds: null };
    const cells = view.sharedMap.cells;
    let minX = 0;
    let maxX = 0;
    let minZ = 0;
    let maxZ = 0;
    for (const k of Object.keys(cells)) {
      const p = parseCellKey(k);
      if (!p) continue;
      minX = Math.min(minX, p.gx);
      maxX = Math.max(maxX, p.gx);
      minZ = Math.min(minZ, p.gz);
      maxZ = Math.max(maxZ, p.gz);
    }
    for (const n of view.nodes) {
      const gx = Math.round(n.position.x / 4);
      const gz = Math.round(n.position.z / 4);
      minX = Math.min(minX, gx - 1);
      maxX = Math.max(maxX, gx + 1);
      minZ = Math.min(minZ, gz - 1);
      maxZ = Math.max(maxZ, gz + 1);
    }
    const pad = 2;
    minX -= pad;
    maxX += pad;
    minZ -= pad;
    maxZ += pad;
    const w = maxX - minX + 1;
    const h = maxZ - minZ + 1;
    const g: string[][] = [];
    for (let z = 0; z < h; z++) {
      const row: string[] = [];
      for (let x = 0; x < w; x++) {
        const gx = minX + x;
        const gz = minZ + z;
        const key = `${gx},${gz}`;
        const st = cells[key]?.state ?? "unknown";
        row.push(st);
      }
      g.push(row);
    }
    const ag = view.nodes.map((n) => ({
      gx: Math.round(n.position.x / 4) - minX,
      gz: Math.round(n.position.z / 4) - minZ,
      id: n.nodeId,
    }));
    return { grid: g, agents: ag, bounds: { minX, minZ, w, h } };
  }, [view]);

  if (!view || !bounds) {
    return (
      <Card className="border-border/60 bg-card/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Shared map</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">No map data yet.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/30">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex flex-wrap gap-2 items-center">
          Shared map
          <span className="text-[10px] font-mono text-muted-foreground font-normal">
            {(view.sharedMap.coverage01 * 100).toFixed(0)}% cov · {view.sharedMap.frontier} frontier · {view.sharedMap.targetCells}{" "}
            tgt
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto" id="swarm-map-panel">
        <div
          className={cn(
            "inline-grid gap-px p-1 rounded-md border border-border/50 bg-border/30 transition-shadow duration-300",
            scenarioOverlayClass(scenario ?? view.scenario),
          )}
          style={{
            gridTemplateColumns: `repeat(${bounds.w}, minmax(0, 10px))`,
          }}
        >
          {grid.map((row, zi) =>
            row.map((st, xi) => {
              const agentHere = agents.some((a) => a.gx === xi && a.gz === zi);
              return (
                <div
                  key={`${xi}-${zi}`}
                  title={st}
                  className={`h-2.5 w-2.5 rounded-[2px] ${STATE_COLORS[st] ?? STATE_COLORS.unknown} ${
                    agentHere ? "ring-1 ring-primary ring-offset-0" : ""
                  }`}
                />
              );
            }),
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Monotonic merge + P2P gossip. Agents ringed. Legend: frontier amber, searched green, target red, blocked gray.
        </p>
      </CardContent>
    </Card>
  );
}
