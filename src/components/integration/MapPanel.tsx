import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRuntimeState } from "@/hooks/useRuntimeState";
import { selectCoveragePct, selectMapSyncLabel } from "@/lib/state/selectors";

const cellCls: Record<string, string> = {
  unknown: "bg-zinc-900",
  explored: "bg-emerald-900/50",
  frontier: "bg-sky-900/40 border border-sky-700/50",
  blocked: "bg-zinc-800",
  target: "bg-orange-700/60",
};

export function MapPanel() {
  const { flatEnvelope, mapModel } = useRuntimeState();
  const coverage = selectCoveragePct(flatEnvelope);
  const sync = selectMapSyncLabel(flatEnvelope);

  return (
    <Card className="border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Shared map</CardTitle>
        <p className="text-[11px] text-zinc-500">
          {sync} · {mapModel.syncLabel} · source {mapModel.source}
        </p>
      </CardHeader>
      <CardContent>
        <div
          className="grid gap-px rounded-lg border border-zinc-800 bg-zinc-950 p-1"
          style={{
            gridTemplateColumns: `repeat(${mapModel.cols}, minmax(0, 1fr))`,
          }}
        >
          {mapModel.grid.map((c, i) => (
            <div
              key={i}
              title={`${c.row},${c.col} ${c.state}`}
              className={`aspect-square rounded-[2px] ${cellCls[c.state] ?? cellCls.unknown} ${c.dirty ? "ring-1 ring-amber-500/40" : ""}`}
            />
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-zinc-500">Coverage {coverage.toFixed(0)}% (derived from mission cells)</p>
      </CardContent>
    </Card>
  );
}
