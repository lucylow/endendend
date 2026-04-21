import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/safety")({
  component: SafetyPage,
});

function SafetyPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Safety dashboard</h1>
        <p className="text-sm text-zinc-400">E-stop status, geofence, batteries, thermal timeline (mock).</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-sm text-white">Fleet E-STOP</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-400">
            <Badge className="bg-emerald-600">All clear</Badge>
            <p className="mt-2">No operator halt. Links nominal.</p>
          </CardContent>
        </Card>
        <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-sm text-white">Geofence</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-400">0 active violations · tunnel mesh locked.</CardContent>
        </Card>
        <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-sm text-white">Thermal</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-400">2 advisory events in last hour (mock stream).</CardContent>
        </Card>
      </div>
    </div>
  );
}
