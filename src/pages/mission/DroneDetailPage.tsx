import { Link, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const roles = ["Explorer", "Relay", "Relay", "Extractor", "Standby"] as const;

export function DroneDetailPage() {
  const { id: rawId } = useParams({ strict: false });
  const id = typeof rawId === "string" && rawId.length ? rawId : "drone-0";
  const idx = Math.min(4, Math.max(0, parseInt(id.replace(/\D/g, "") || "0", 10) || 0));

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base text-white">Camera — {id}</CardTitle>
          <Button asChild size="sm" variant="outline" className="border-white/15">
            <Link to="/swarm">Back to swarm</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black/70">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(34,211,238,0.08),transparent_55%)]" />
            <div className="absolute left-[18%] top-[32%] h-[22%] w-[28%] rounded-md border-2 border-amber-400/90 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]" aria-hidden />
            <p className="absolute bottom-3 left-3 rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-amber-200">YOLO overlay (mock)</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-200">Telemetry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="flex justify-between text-zinc-400">
                <span>Battery</span>
                <span className="font-mono text-zinc-100">87%</span>
              </div>
              <Progress value={87} className="mt-1 h-2" />
            </div>
            <div className="flex justify-between border-b border-white/5 py-2 text-zinc-400">
              <span>Role</span>
              <span className="font-medium text-cyan-300">{roles[idx]}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Depth</span>
              <span className="font-mono text-zinc-100">45.2 m</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Temp</span>
              <span className="font-mono text-zinc-100">62°C</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Loss</span>
              <span className="font-mono text-amber-300">23%</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => toast.success("RTL (demo)")} aria-label="Return to launch">
            RTL
          </Button>
          <Button type="button" variant="destructive" onClick={() => toast.error("E-STOP this drone (demo)")} aria-label="Emergency stop this drone">
            E-STOP
          </Button>
          <Button type="button" variant="outline" className="border-white/15" onClick={() => toast.message("Role override (demo)")} aria-label="Role override">
            Role override
          </Button>
        </div>
      </div>
    </div>
  );
}
