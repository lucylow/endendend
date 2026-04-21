import type { ScenarioKey } from "./ScenarioSwitcher";
import type { TashiStateEnvelope } from "@/types/tashi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { typography } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

export function ScenarioMainPanel({
  scenario,
  envelope,
}: {
  scenario: ScenarioKey | string;
  envelope: TashiStateEnvelope;
}) {
  const roster = envelope.backend?.mission.roster;
  const relayish =
    roster != null
      ? Object.values(roster).filter(
          (r) => r.role === "relay" || r.capabilities.some((c) => c.toLowerCase().includes("relay")),
        ).length
      : envelope.nodes.filter((n) => n.role === "relay").length;
  const thermalCapable =
    roster != null
      ? Object.values(roster).filter((r) => r.capabilities.some((c) => c.toLowerCase().includes("thermal"))).length
      : envelope.nodes.filter((n) => n.role === "explorer").length;

  const meshLatency = envelope.simulation?.mesh.meanLatencyMs;

  if (scenario === "collapsed_building") {
    const relayStabilityPct = envelope.nodes.length
      ? Math.min(99, Math.round((relayish / Math.max(1, envelope.nodes.length)) * 100))
      : 0;
    return (
      <Card variant="mission" className="border-orange-500/25 bg-orange-500/[0.07]">
        <CardHeader>
          <CardTitle className={cn("flex flex-wrap items-center justify-between gap-2 text-base", typography.sans)}>
            Collapsed Building Command View
            <Badge variant="secondary">Relay + Triage Focus</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Metric label="Relay share" value={`${relayStabilityPct}%`} />
          <Metric label="Targets tracked" value={`${envelope.mapSummary.targets.length}`} />
          <Metric label="Coverage" value={`${envelope.mapSummary.coveragePercent.toFixed(1)}%`} />
          {meshLatency != null ? <Metric label="Mesh latency (sim)" value={`${meshLatency} ms`} /> : null}
        </CardContent>
      </Card>
    );
  }

  if (scenario === "wildfire") {
    const corridors = Math.max(0, envelope.mapSummary.targets.length + relayish - 1);
    const heatStress =
      envelope.mapSummary.coveragePercent > 70 ? "elevated" : envelope.mapSummary.coveragePercent > 40 ? "moderate" : "watch";
    return (
      <Card variant="mission" className="border-red-500/25 bg-red-500/[0.07]">
        <CardHeader>
          <CardTitle className={cn("flex flex-wrap items-center justify-between gap-2 text-base", typography.sans)}>
            Wildfire Command View
            <Badge variant="secondary">Thermal + Evacuation Focus</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Metric label="Thermal-capable nodes" value={`${thermalCapable}`} />
          <Metric label="Corridor hints" value={`${corridors}`} />
          <Metric label="Coverage" value={`${envelope.mapSummary.coveragePercent.toFixed(1)}%`} />
          <Metric label="Heat stress (derived)" value={heatStress} />
          {meshLatency != null ? <Metric label="Mesh latency (sim)" value={`${meshLatency} ms`} /> : null}
        </CardContent>
      </Card>
    );
  }

  if (scenario === "flood_rescue") {
    const depthHint = Math.round(envelope.mapSummary.coveragePercent * 0.8);
    const lanes = Math.max(1, relayish);
    return (
      <Card variant="mission" className="border-sky-500/25 bg-sky-500/[0.06]">
        <CardHeader>
          <CardTitle className={cn("flex flex-wrap items-center justify-between gap-2 text-base", typography.sans)}>
            Flood Rescue Command View
            <Badge variant="secondary">Water depth + transport lanes</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Metric label="Depth index (sim)" value={`${depthHint}`} />
          <Metric label="Transport / relay lanes" value={`${lanes}`} />
          <Metric label="Coverage" value={`${envelope.mapSummary.coveragePercent.toFixed(1)}%`} />
          <Metric label="Targets" value={`${envelope.mapSummary.targets.length}`} />
          {meshLatency != null ? <Metric label="Mesh latency (sim)" value={`${meshLatency} ms`} /> : null}
        </CardContent>
      </Card>
    );
  }

  if (scenario === "hazmat") {
    const plume = envelope.mapSummary.targets.length;
    const exclusion = envelope.alerts.filter((a) => a.severity === "critical").length;
    return (
      <Card variant="mission" className="border-amber-500/30 bg-amber-500/[0.06]">
        <CardHeader>
          <CardTitle className={cn("flex flex-wrap items-center justify-between gap-2 text-base", typography.sans)}>
            Hazmat Command View
            <Badge variant="secondary">Gas readings + exclusion zones</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Metric label="Contour sources" value={`${plume}`} />
          <Metric label="Critical safety flags" value={`${exclusion}`} />
          <Metric label="Coverage" value={`${envelope.mapSummary.coveragePercent.toFixed(1)}%`} />
          {meshLatency != null ? <Metric label="Mesh latency (sim)" value={`${meshLatency} ms`} /> : null}
        </CardContent>
      </Card>
    );
  }

  if (scenario === "tunnel") {
    const depth = Math.min(99, envelope.mapSummary.exploredCells);
    const dead = envelope.nodes.filter((n) => n.health === "stale").length;
    return (
      <Card variant="mission" className="border-emerald-500/25 bg-emerald-500/[0.06]">
        <CardHeader>
          <CardTitle className={cn("flex flex-wrap items-center justify-between gap-2 text-base", typography.sans)}>
            Tunnel Command View
            <Badge variant="secondary">Relay depth + dead zones</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Metric label="Relay chain depth (cells)" value={`${depth}`} />
          <Metric label="Stale / dead-zone nodes" value={`${dead}`} />
          <Metric label="Coverage" value={`${envelope.mapSummary.coveragePercent.toFixed(1)}%`} />
          {meshLatency != null ? <Metric label="Mesh latency (sim)" value={`${meshLatency} ms`} /> : null}
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
        <Metric label="Active nodes" value={`${envelope.nodes.length}`} />
        <Metric label="Targets" value={`${envelope.mapSummary.targets.length}`} />
        <Metric label="Coverage" value={`${envelope.mapSummary.coveragePercent.toFixed(1)}%`} />
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
