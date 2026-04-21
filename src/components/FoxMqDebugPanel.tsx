import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScenarioMapProfile } from "@/foxmq/types";

type Props = { profile: ScenarioMapProfile | null };

export function FoxMqDebugPanel({ profile }: Props) {
  if (!profile) return null;
  return (
    <Card className="border-dashed border-border/60 bg-card/15">
      <CardHeader className="py-3">
        <CardTitle className="text-xs">Scenario map profile (seeded dynamics)</CardTitle>
      </CardHeader>
      <CardContent className="text-[10px] font-mono text-muted-foreground space-y-0.5">
        <div>scenario: {profile.scenario}</div>
        <div>hazard01: {profile.hazardRate01.toFixed(2)} · relay01: {profile.relayImportance01.toFixed(2)}</div>
        <div>frontier01: {profile.frontierDensity01.toFixed(2)} · sync urgency: {profile.syncUrgency01.toFixed(2)}</div>
      </CardContent>
    </Card>
  );
}
