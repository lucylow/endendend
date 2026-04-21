import type { ScenarioKey } from "./ScenarioSwitcher";
import type { TashiStateEnvelope } from "@/types/tashi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ScenarioMainPanel({
  scenario,
  envelope,
}: {
  scenario: ScenarioKey;
  envelope: TashiStateEnvelope;
}) {
  if (scenario === "collapsed_building") {
    return (
      <Card className="border-orange-500/20 bg-orange-500/5">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Collapsed Building Command View
            <Badge variant="secondary">Relay + Triage Focus</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Metric label="Relay Stability" value="92%" />
          <Metric label="Victims Confirmed" value={`${envelope.mapSummary.targets.length}`} />
          <Metric label="Coverage" value={`${envelope.mapSummary.coveragePercent.toFixed(1)}%`} />
        </CardContent>
      </Card>
    );
  }

  if (scenario === "wildfire") {
    return (
      <Card className="border-red-500/20 bg-red-500/5">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Wildfire Command View
            <Badge variant="secondary">Thermal + Evacuation Focus</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Metric label="Heat Front" value="High" />
          <Metric label="Safe Corridors" value="3" />
          <Metric label="Coverage" value={`${envelope.mapSummary.coveragePercent.toFixed(1)}%`} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scenario Command View</CardTitle>
      </CardHeader>
      <CardContent className="text-zinc-400">
        {scenario.replaceAll("_", " ")} metrics go here.
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
