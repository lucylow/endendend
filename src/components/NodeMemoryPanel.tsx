import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Props = {
  collectiveHealthPct: number;
  recoveryPct: number;
  offlinePreserved: Record<string, number>;
};

export function NodeMemoryPanel({ collectiveHealthPct, recoveryPct, offlinePreserved }: Props) {
  const entries = Object.entries(offlinePreserved);
  return (
    <Card className="border-border/60 bg-card/25">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Collective memory</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div>
          <div className="flex justify-between text-muted-foreground mb-1">
            <span>Fleet retention health</span>
            <span>{collectiveHealthPct.toFixed(0)}%</span>
          </div>
          <Progress value={collectiveHealthPct} className="h-1.5" />
        </div>
        <div>
          <div className="flex justify-between text-muted-foreground mb-1">
            <span>Partition recovery</span>
            <span>{recoveryPct.toFixed(0)}%</span>
          </div>
          <Progress value={recoveryPct} className="h-1.5" />
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Offline node map cells still visible fleet-wide</div>
          {entries.length === 0 ? (
            <p className="text-muted-foreground">No offline-first sector retention this tick.</p>
          ) : (
            <ul className="font-mono text-[10px] space-y-0.5">
              {entries.map(([id, n]) => (
                <li key={id}>
                  {id}: <span className="text-emerald-400/90">{n}</span> cells
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
