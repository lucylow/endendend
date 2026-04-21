import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRuntimeState } from "@/hooks/useRuntimeState";
import { selectActiveNodeCount, selectStaleNodeCount } from "@/lib/state/selectors";

export function NodeRegistryPanel() {
  const { flatEnvelope } = useRuntimeState();
  const active = selectActiveNodeCount(flatEnvelope);
  const stale = selectStaleNodeCount(flatEnvelope);

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Node registry</CardTitle>
        <p className="text-[11px] text-zinc-500">
          {active} active · {stale} stale · trust from Lattice
        </p>
      </CardHeader>
      <CardContent className="max-h-56 overflow-y-auto space-y-2 pr-1">
        {flatEnvelope.nodes.map((node) => (
          <div
            key={node.nodeId}
            className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5 text-[11px]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  node.health === "online" ? "bg-emerald-500" : node.health === "stale" ? "bg-zinc-600" : "bg-amber-500"
                }`}
              />
              <span className="font-mono truncate">{node.nodeId}</span>
            </div>
            <div className="shrink-0 text-right text-zinc-400">
              <div className="uppercase text-[10px]">{node.role}</div>
              <div>bat {(node.battery * 100).toFixed(0)}%</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
