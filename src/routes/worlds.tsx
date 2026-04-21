import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/worlds")({
  component: WorldsPage,
});

function WorldsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Simulation worlds</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-sm text-white">Blackout tunnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-zinc-400">
            <p>Webots world: `worlds/blackout_tunnel.wbt` (repo).</p>
            <Button asChild size="sm" variant="outline" className="border-white/15">
              <Link to="/scenarios/daisy">Open daisy chain viz</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-sm text-white">Victim spawner</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-400">Wire to ROS2 victim topics for live SAR.</CardContent>
        </Card>
      </div>
    </div>
  );
}
