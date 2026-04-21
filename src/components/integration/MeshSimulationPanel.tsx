import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FlatMissionEnvelope } from "@/lib/state/types";

export function MeshSimulationPanel({ envelope }: { envelope: FlatMissionEnvelope }) {
  const sim = envelope.simulation;
  if (!sim) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Mesh simulation</CardTitle>
        </CardHeader>
        <CardContent className="text-[11px] text-zinc-500">Waiting for simulator tick…</CardContent>
      </Card>
    );
  }
  const { mesh } = sim;
  return (
    <Card className="border-sky-500/15 bg-sky-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          Mesh network (mock)
          {mesh.partitionActive ? (
            <Badge variant="destructive" className="text-[10px]">
              Partition
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              Connected
            </Badge>
          )}
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          Route quality {Math.round(mesh.routeQuality * 100)}% · mean latency {mesh.meanLatencyMs} ms · delivered{" "}
          {mesh.delivery.delivered}/{mesh.delivery.attempted}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-[11px]">
        <div>
          <div className="text-zinc-500 uppercase tracking-wide">Relay chain</div>
          <div className="mt-1 font-mono text-zinc-300">{mesh.relayChain.primary.join(" → ") || "—"}</div>
          {mesh.relayChain.backup.length > 0 && (
            <div className="mt-0.5 font-mono text-zinc-500">backup: {mesh.relayChain.backup.join(" → ")}</div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Retries" value={String(mesh.delivery.retries)} />
          <Stat label="Duplicates" value={String(mesh.delivery.duplicates)} />
          <Stat label="Dropped" value={String(mesh.delivery.dropped)} />
          <Stat label="Stale peers" value={String(mesh.stalePeers.length)} />
        </div>
        <div>
          <div className="text-zinc-500 uppercase tracking-wide">Active edges</div>
          <div className="mt-1 max-h-24 space-y-1 overflow-y-auto pr-1 font-mono text-zinc-400">
            {mesh.graphEdges.slice(0, 8).map((e, i) => (
              <div key={i} className="flex justify-between gap-2 border-b border-zinc-800/60 pb-0.5">
                <span className="truncate">
                  {e.from}↔{e.to}
                  {e.relay ? " · R" : ""}
                </span>
                <span className="shrink-0 text-zinc-500">
                  {e.latencyMs}ms · {e.status}
                </span>
              </div>
            ))}
            {mesh.graphEdges.length === 0 && <span className="text-zinc-600">No edges (nodes offline)</span>}
          </div>
        </div>
        <div>
          <div className="text-zinc-500 uppercase tracking-wide">Topic subscriptions (sample)</div>
          <div className="mt-1 space-y-1">
            {mesh.subscriptionsSample.map((s) => (
              <div key={s.nodeId} className="font-mono text-[10px] text-zinc-500">
                <span className="text-zinc-400">{s.nodeId}</span>: {s.topics.join(", ")}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-2 py-1">
      <div className="text-[10px] uppercase text-zinc-500">{label}</div>
      <div className="font-mono text-zinc-200">{value}</div>
    </div>
  );
}
