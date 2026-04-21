import { memo, useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { ScenarioKey } from "./ScenarioSwitcher";
import type { TashiStateEnvelope } from "@/types/tashi";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { typography } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { RelayChain } from "./RelayChain";
import { DeadZoneMap } from "./DeadZoneMap";
import { useThermalData, useWaterDepth, useGasReadings } from "@/hooks/useSarMockSensors";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useMapOverlayStore } from "@/store/mapOverlayStore";
import { parseCellKey } from "@/swarm/sharedMap";
import { AlertTriangle, Flame, Radio, ShieldCheck, Skull, Waves } from "lucide-react";

function GasGauge({ ppm, label }: { ppm: number; label: string }) {
  const tier = ppm < 120 ? "safe" : ppm < 280 ? "warning" : "danger";
  const colors = { safe: "#22c55e", warning: "#eab308", danger: "#ef4444" };
  const pct = Math.min(100, (ppm / 500) * 100);
  return (
    <div className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-zinc-400 truncate">{label}</span>
        <Badge variant={tier === "safe" ? "secondary" : tier === "warning" ? "outline" : "destructive"} className="text-[9px]">
          {tier === "safe" ? "OK" : tier === "warning" ? "Warn" : "DNG"}
        </Badge>
      </div>
      <div className="text-lg font-semibold tabular-nums" style={{ color: colors[tier] }}>
        {ppm} <span className="text-[10px] font-normal text-zinc-500">ppm</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

export const RichScenarioMainPanel = memo(function RichScenarioMainPanel({
  scenario,
  envelope,
  view,
  onReassignDrone,
}: {
  scenario: ScenarioKey | string;
  envelope: TashiStateEnvelope;
  view: VertexSwarmView | null | undefined;
  onReassignDrone?: (nodeId: string) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const thermalOpacity = useMapOverlayStore((s) => s.thermalOpacity01);
  const setThermalOpacity = useMapOverlayStore((s) => s.setThermalOpacity01);
  const waterBoost = useMapOverlayStore((s) => s.waterLevelBoost01);
  const setWaterBoost = useMapOverlayStore((s) => s.setWaterLevelBoost01);
  const setWaterOpacity = useMapOverlayStore((s) => s.setWaterOpacity01);
  const waterOpacity = useMapOverlayStore((s) => s.waterOpacity01);
  const gasContourIntensity = useMapOverlayStore((s) => s.gasContourIntensity01);
  const setGasContourIntensity = useMapOverlayStore((s) => s.setGasContourIntensity01);

  const thermal = useThermalData(view ?? null);
  const water = useWaterDepth(view ?? null);
  const gas = useGasReadings(view ?? null);

  const explorerId = useMemo(() => view?.nodes.find((n) => n.role === "explorer")?.nodeId ?? null, [view?.nodes]);
  const chainIds = useMemo(() => {
    const chains = envelope.relayChains;
    if (chains?.length && chains[0]?.length) return chains[0];
    const relays = envelope.nodes.filter((n) => n.role === "relay").map((n) => n.nodeId);
    const ordered = [...relays];
    if (explorerId && !ordered.includes(explorerId)) ordered.push(explorerId);
    return ordered.length ? ordered : envelope.nodes.map((n) => n.nodeId);
  }, [envelope.nodes, envelope.relayChains, explorerId]);

  const victimRows = useMemo(() => {
    return [...envelope.mapSummary.targets].map((t) => {
      const conf = t.confidence;
      const priority =
        conf >= 0.85 ? "critical" : conf >= 0.55 ? "injured" : "trapped";
      const depthM = Math.round((1 - conf) * 12 * 10) / 10;
      const assignee =
        view?.tasks.find((x) => x.status === "assigned" && x.taskType.toLowerCase().includes("rescue"))?.winnerNodeId ??
        view?.nodes.find((n) => n.role === "explorer")?.nodeId ??
        "—";
      return { ...t, priority, depthM, assignee };
    }).sort((a, b) => b.confidence - a.confidence);
  }, [envelope.mapSummary.targets, view?.tasks, view?.nodes]);

  const structuralRisk = useMemo(() => {
    const cov = envelope.mapSummary.coveragePercent / 100;
    const stress = view?.meshV2?.consensus.health.pending ?? 0;
    return Math.min(100, Math.round((0.45 + cov * 0.35 + Math.min(1, stress / 12) * 0.35) * 100));
  }, [envelope.mapSummary.coveragePercent, view?.meshV2?.consensus.health.pending]);

  const geofenceViolations = useMemo(() => {
    if (!view) return [];
    const limit = 20;
    return view.nodes.filter((n) => Math.hypot(n.position.x, n.position.z) > limit).map((n) => n.nodeId);
  }, [view]);

  const hazmatRadiusM = useMemo(() => 12 + envelope.mapSummary.targets.length * 2, [envelope.mapSummary.targets.length]);
  const dronesInsideExclusion = useMemo(() => {
    if (!view) return [];
    const r = hazmatRadiusM;
    return view.nodes.filter((n) => Math.hypot(n.position.x - 2, n.position.z + 1) < r * 0.15).map((n) => n.nodeId);
  }, [view, hazmatRadiusM]);

  const emergencyStop = envelope.alerts.some((a) => a.type.includes("blackout") || a.severity === "critical");

  const complianceList = useMemo(() => {
    return envelope.nodes.filter((n) => {
      const g = gas.byNodeId[n.nodeId] ?? 0;
      return g < 150 && (n.health === "online" || n.health === "syncing");
    });
  }, [envelope.nodes, gas.byNodeId]);

  const corridorCount = Math.max(1, envelope.mapSummary.targets.length + Math.max(0, chainIds.length - 2));

  const lanes = useMemo(() => {
    const ids = ["lane-N", "lane-NE", "lane-E", "lane-S"];
    return ids.map((id, i) => {
      const d = (water.meanDepthM + i * 0.22) % 5;
      const status = d < 1 ? "passable" : d > 1.5 ? "blocked" : "caution";
      return { id, depthM: Math.round(d * 10) / 10, status };
    });
  }, [water.meanDepthM]);

  const stranded = useMemo(() => {
    return victimRows.filter((v) => v.depthM > 1);
  }, [victimRows]);

  const extractionDone = envelope.mapSummary.targets.filter((t) => t.status === "confirmed").length;
  const extractionTotal = Math.max(victimRows.length, 1);

  const thermalCapable = useMemo(() => {
    if (!view) return [];
    return view.nodes.filter((n) => n.capabilities.thermalScore > 0.35);
  }, [view]);

  const smokeResilient = useMemo(() => {
    if (!view) return [];
    return view.nodes.filter((n) => n.capabilities.indoorScore > 0.45 || n.capabilities.lidarScore > 0.4);
  }, [view]);

  const depthSeries = useMemo(() => {
    if (!view) return [];
    const t0 = view.nowMs - 60_000;
    return chainIds.map((id, i) => {
      const n = view.nodes.find((x) => x.nodeId === id);
      const depth = n ? Math.max(0, (n.position.y + 2) * 3.2) : 0;
      return { t: t0 + i * 5000, node: id.replace(/^agent-/, ""), depth: Math.round(depth * 10) / 10 };
    });
  }, [view, chainIds]);

  const rescueTargetDepthM = 18;
  const explorerDepthNow = useMemo(() => {
    const ex = view?.nodes.find((n) => n.role === "explorer");
    return ex ? Math.round(Math.max(0, (ex.position.y + 2) * 3.2) * 10) / 10 : 0;
  }, [view?.nodes]);

  const deadZoneCells = useMemo(() => {
    if (!view) return [];
    const cells: { gx: number; gz: number; kind: "unknown" | "dead" }[] = [];
    const entries = Object.entries(view.sharedMap.cells).slice(0, 400);
    for (const [k, meta] of entries) {
      const p = parseCellKey(k);
      if (!p) continue;
      if (meta.state === "frontier") {
        cells.push({ gx: p.gx, gz: p.gz, kind: "unknown" });
      }
    }
    for (const n of view.nodes) {
      const loss = n.nodeId ? (envelope.nodes.find((x) => x.nodeId === n.nodeId)?.packetLoss01 ?? 0) : 0;
      if (loss > 0.9) {
        const gx = Math.round(n.position.x / 4);
        const gz = Math.round(n.position.z / 4);
        cells.push({ gx, gz, kind: "dead" });
      }
    }
    return cells.slice(0, 220);
  }, [view, envelope.nodes]);

  const losPairs = useMemo(() => {
    if (!view) return [];
    const pairs: string[] = [];
    const nodes = view.nodes;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dDepth = Math.abs(a.position.y - b.position.y);
        const edge = view.graph.edges.find((e) => (e.a === a.nodeId && e.b === b.nodeId) || (e.a === b.nodeId && e.b === a.nodeId));
        const loss = edge?.loss ?? 1;
        if (dDepth < 6 && loss < 0.45) {
          pairs.push(`${a.nodeId.replace("agent-", "")}↔${b.nodeId.replace("agent-", "")}`);
        }
      }
    }
    return pairs.slice(0, 12);
  }, [view]);

  if (scenario === "collapsed_building") {
    return (
      <Card variant="mission" className="border-orange-500/25 bg-orange-500/[0.07]">
        <CardHeader>
          <CardTitle className={cn("flex flex-wrap items-center justify-between gap-2 text-base", typography.sans)}>
            Collapsed Building
            <Badge variant="secondary" className="gap-1">
              <Radio className="h-3.5 w-3.5" aria-hidden />
              Relay + triage
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Relay chain stability</h3>
            <RelayChain orderedIds={chainIds} explorerId={explorerId} reducedMotion={reducedMotion} />
          </section>
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Victim triage queue</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Depth</TableHead>
                  <TableHead>Conf.</TableHead>
                  <TableHead>Drone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {victimRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-xs text-muted-foreground">
                      No provisional targets — inject a candidate from the toolbar.
                    </TableCell>
                  </TableRow>
                ) : (
                  victimRows.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">{v.id}</TableCell>
                      <TableCell>
                        <Badge variant={v.priority === "critical" ? "destructive" : "secondary"} className="text-[10px]">
                          {v.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{v.depthM} m</TableCell>
                      <TableCell className="text-xs">{(v.confidence * 100).toFixed(0)}%</TableCell>
                      <TableCell className="font-mono text-[10px]">{String(v.assignee).replace(/^agent-/, "")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </section>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Secondary collapse risk</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{structuralRisk}%</div>
              <Progress value={structuralRisk} className="mt-3 h-2" />
              <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
                Derived from coverage stress and consensus backlog — not a certified structural model.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-hidden />
                Geofence violations
              </div>
              {geofenceViolations.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">All drones inside the operational tunnel geofence.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {geofenceViolations.map((id) => (
                    <li key={id} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono">{id}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-[10px]"
                        disabled={!onReassignDrone}
                        onClick={() => onReassignDrone?.(id)}
                        aria-label={`Reassign mission role for ${id}`}
                      >
                        Reassign
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (scenario === "wildfire") {
    return (
      <Card variant="mission" className="border-red-500/25 bg-red-500/[0.07]">
        <CardHeader>
          <CardTitle className={cn("flex flex-wrap items-center justify-between gap-2 text-base", typography.sans)}>
            Wildfire
            <Badge variant="secondary" className="gap-1">
              <Flame className="h-3.5 w-3.5 text-orange-400" aria-hidden />
              Thermal + evacuation
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Heatmap overlay opacity</span>
              <Badge variant="outline" className="text-[10px] tabular-nums">
                {Math.round(thermalOpacity * 100)}%
              </Badge>
            </div>
            <Slider
              value={[thermalOpacity]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={(v) => setThermalOpacity(v[0] ?? 0.55)}
              aria-label="Thermal heatmap opacity on 3D map"
            />
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-4 rounded bg-red-900" aria-hidden /> Low thermal
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-4 rounded bg-orange-500" aria-hidden /> Front
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-4 rounded bg-yellow-300" aria-hidden /> Hot core
              </span>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 p-3">
              <div className="text-[10px] uppercase text-zinc-500">Safe corridors</div>
              <div className="text-2xl font-semibold">{corridorCount}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Hints from targets + relay span (demo heuristic).</p>
            </div>
            <div className="rounded-lg border border-zinc-800 p-3">
              <div className="text-[10px] uppercase text-zinc-500">Fire front (sim)</div>
              <div className="font-mono text-xs">
                x {thermal.fireFront.x.toFixed(1)} · z {thermal.fireFront.z.toFixed(1)}
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Evacuation routes</h3>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <Badge>Primary</Badge> Ridge line east — thermal {Math.round((thermal.byNodeId[view?.nodes[0]?.nodeId ?? ""] ?? 0.4) * 100)}% rel.
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="secondary">Secondary</Badge> Creek bed north — smoke model deferred.
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Hazard clearance roster</h3>
            <div className="flex flex-wrap gap-2">
              {thermalCapable.map((n) => (
                <Badge key={n.nodeId} variant="outline" className="font-mono text-[10px] gap-1">
                  <Flame className="h-3 w-3 text-orange-400" aria-hidden />
                  {n.nodeId.replace(/^agent-/, "")} thermal
                </Badge>
              ))}
              {smokeResilient.map((n) => (
                <Badge key={`${n.nodeId}-sm`} variant="secondary" className="font-mono text-[10px] gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" aria-hidden />
                  {n.nodeId.replace(/^agent-/, "")} smoke/LiDAR
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (scenario === "flood_rescue") {
    return (
      <Card variant="mission" className="border-sky-500/25 bg-sky-500/[0.06]">
        <CardHeader>
          <CardTitle className={cn("flex flex-wrap items-center justify-between gap-2 text-base", typography.sans)}>
            Flood Rescue
            <Badge variant="secondary" className="gap-1">
              <Waves className="h-3.5 w-3.5" aria-hidden />
              Depth + transport
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="flex justify-between text-[10px] uppercase text-zinc-500 mb-1">
                <span>Mean depth (sim)</span>
                <span className="tabular-nums">{water.meanDepthM.toFixed(1)} m</span>
              </div>
              <Progress value={Math.min(100, (water.meanDepthM / 5) * 100)} className="h-2" />
              <p className="mt-2 text-[11px] text-muted-foreground">Gauge 0–5 m — drives blue plane height on the map.</p>
            </div>
            <div>
              <div className="text-[10px] uppercase text-zinc-500 mb-2">Water plane opacity</div>
              <Slider
                value={[waterOpacity]}
                min={0.1}
                max={0.85}
                step={0.05}
                onValueChange={(v) => setWaterOpacity(v[0] ?? 0.35)}
                aria-label="Flood water overlay opacity"
              />
              <div className="text-[10px] uppercase text-zinc-500 mt-3 mb-1">Tide boost (demo)</div>
              <Slider
                value={[waterBoost]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={(v) => setWaterBoost(v[0] ?? 0)}
                aria-label="Simulated tide level boost"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-[10px]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-4 rounded bg-sky-300" aria-hidden /> Shallow
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-4 rounded bg-sky-600" aria-hidden /> Deep
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-4 rounded bg-indigo-950" aria-hidden /> Hazard current
            </span>
          </div>
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Transport lane availability</h3>
            <div className="flex flex-wrap gap-2">
              {lanes.map((lane) => (
                <Badge
                  key={lane.id}
                  variant={lane.status === "passable" ? "default" : lane.status === "blocked" ? "destructive" : "secondary"}
                  className="font-mono text-[10px]"
                >
                  {lane.id} · {lane.depthM} m · {lane.status}
                </Badge>
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Stranded targets (&gt;1 m)</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Depth</TableHead>
                  <TableHead>Rover</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stranded.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-xs text-muted-foreground">
                      No deep-water strandings on the mock field.
                    </TableCell>
                  </TableRow>
                ) : (
                  stranded.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">{v.id}</TableCell>
                      <TableCell className="text-xs">{v.depthM} m</TableCell>
                      <TableCell className="text-xs">Rover-{v.assignee?.toString().slice(-1) ?? "?"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </section>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Extraction progress</span>
              <span className="tabular-nums">
                {extractionDone} / {extractionTotal}
              </span>
            </div>
            <Progress value={(extractionDone / extractionTotal) * 100} className="h-2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (scenario === "hazmat") {
    return (
      <Card variant="mission" className="border-amber-500/30 bg-amber-500/[0.06]">
        <CardHeader>
          <CardTitle className={cn("flex flex-wrap items-center justify-between gap-2 text-base", typography.sans)}>
            Hazmat
            <Badge variant="secondary" className="gap-1">
              <Skull className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              Gas + exclusion
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="max-w-md space-y-2">
            <div className="flex justify-between text-[10px] uppercase text-zinc-500">
              <span>Gas contour field strength</span>
              <span className="tabular-nums">{Math.round(gasContourIntensity * 100)}%</span>
            </div>
            <Slider
              value={[gasContourIntensity]}
              min={0.15}
              max={1}
              step={0.05}
              onValueChange={(v) => setGasContourIntensity(v[0] ?? 0.65)}
              aria-label="Hazmat gas contour intensity on map"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {envelope.nodes.map((n) => (
              <GasGauge key={n.nodeId} label={n.nodeId.replace(/^agent-/, "")} ppm={gas.byNodeId[n.nodeId] ?? 0} />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 p-3 space-y-2">
              <div className="text-[10px] uppercase text-zinc-500">Exclusion zone radius</div>
              <div className="text-xl font-semibold">{hazmatRadiusM} m</div>
              <p className="text-[11px] text-muted-foreground">Rendered as a translucent shell on the map (demo anchor at x=2, z=-1).</p>
            </div>
            <div className="rounded-lg border border-zinc-800 p-3 space-y-2">
              <div className="text-[10px] uppercase text-zinc-500">Drones inside zone</div>
              {dronesInsideExclusion.length === 0 ? (
                <p className="text-xs text-muted-foreground">None — standoff preserved.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {dronesInsideExclusion.map((id) => (
                    <Badge key={id} variant="destructive" className="font-mono text-[10px]">
                      {id}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div
            className={cn(
              "rounded-lg border p-3 flex flex-wrap items-center gap-3",
              emergencyStop ? "border-red-500/60 bg-red-500/10" : "border-emerald-500/40 bg-emerald-500/10",
            )}
            role="status"
            aria-live="polite"
          >
            <span className="text-sm font-semibold">{emergencyStop ? "Emergency stop asserted" : "Emergency stop clear"}</span>
            <Badge variant={emergencyStop ? "destructive" : "secondary"}>
              {emergencyStop ? "Isolate + vent" : "Nominal"}
            </Badge>
          </div>
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Safety compliance</h3>
            <div className="flex flex-wrap gap-2">
              {complianceList.map((n) => (
                <Badge key={n.nodeId} variant="outline" className="text-[10px] gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" aria-hidden />
                  {n.nodeId.replace(/^agent-/, "")} sealed / low ppm
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (scenario === "tunnel") {
    return (
      <Card variant="mission" className="border-emerald-500/25 bg-emerald-500/[0.06]">
        <CardHeader>
          <CardTitle className={cn("flex flex-wrap items-center justify-between gap-2 text-base", typography.sans)}>
            Tunnel
            <Badge variant="secondary">Depth + dead air</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Relay depth by hop</h3>
            <RelayChain orderedIds={chainIds} explorerId={explorerId} reducedMotion={reducedMotion} />
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {chainIds.map((id) => {
                const n = view?.nodes.find((x) => x.nodeId === id);
                const d = n ? Math.round((n.position.y + 2) * 3.2 * 10) / 10 : 0;
                return (
                  <div key={id} className="rounded-md border border-zinc-800 px-2 py-1 text-center">
                    <div className="text-[9px] text-zinc-500 font-mono truncate">{id.replace(/^agent-/, "")}</div>
                    <div className="text-sm font-semibold">{d} m</div>
                  </div>
                );
              })}
            </div>
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Depth progression</h3>
              <div className="h-48 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={depthSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="t" hide />
                    <YAxis stroke="#71717a" fontSize={10} width={36} label={{ value: "m", angle: -90, position: "insideLeft" }} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 11 }}
                      formatter={(v: number) => [`${v} m`, "depth"]}
                    />
                    <Line type="monotone" dataKey="depth" stroke="#34d399" dot strokeWidth={2} isAnimationActive={!reducedMotion} name="Depth" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Dead-zone map</h3>
              <DeadZoneMap cells={deadZoneCells} />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Unknown / frontier cells from ``sharedMap`` plus packet-loss &gt;90% pockets.
              </p>
            </div>
          </div>
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Line-of-sight pairs (sim)</h3>
            <p className="text-xs text-muted-foreground break-words">{losPairs.length ? losPairs.join(" · ") : "No stable LOS pairs under stress."}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 p-3">
            <div className="text-[10px] uppercase text-zinc-500 mb-1">Rescue depth progress</div>
            <div className="text-sm">
              Explorer depth <span className="font-mono text-cyan-300">{explorerDepthNow} m</span> · Target{" "}
              <span className="font-mono text-emerald-300">{rescueTargetDepthM} m</span>
            </div>
            <Progress value={Math.min(100, (explorerDepthNow / rescueTargetDepthM) * 100)} className="mt-2 h-2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="mission" className="border-zinc-700/80">
      <CardHeader>
        <CardTitle className={cn("text-base", typography.sans)}>Scenario Command View</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3 text-zinc-400">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Active nodes</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{envelope.nodes.length}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Targets</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{envelope.mapSummary.targets.length}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Coverage</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{envelope.mapSummary.coveragePercent.toFixed(1)}%</div>
        </div>
      </CardContent>
    </Card>
  );
});
