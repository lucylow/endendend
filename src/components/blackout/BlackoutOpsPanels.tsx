import { useMemo } from "react";
import { MapPin, Copy, Download } from "lucide-react";
import type { FlatMissionEnvelope } from "@/lib/state/types";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { typography, colors } from "@/lib/design-tokens";

function recoveryBadgeForHealth(h: FlatMissionEnvelope["nodes"][0]["health"]): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  switch (h) {
    case "online":
      return { label: "recovered", variant: "secondary" };
    case "syncing":
      return { label: "syncing", variant: "outline" };
    case "degraded":
      return { label: "degraded", variant: "outline" };
    case "stale":
      return { label: "stale", variant: "destructive" };
    default:
      return { label: "unknown", variant: "outline" };
  }
}

export function BlackoutSafetyPanel({
  envelope,
  onShowOnMap,
}: {
  envelope: FlatMissionEnvelope;
  onShowOnMap?: () => void;
}) {
  return (
    <Card variant="alert" className="border-zinc-800">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Safety & alerts</CardTitle>
        <CardDescription className="text-xs">Surface warnings before they disappear into logs.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {envelope.alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active safety alerts.</p>
        ) : (
          <ScrollArea className="max-h-[200px] pr-2">
            <ul className="space-y-2">
              {envelope.alerts.map((a, i) => (
                <li
                  key={`${a.nodeId}-${i}`}
                  className={cn(
                    "rounded-lg border p-2 text-xs flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
                    a.severity === "critical" ? "border-red-500/35 bg-red-500/[0.08]" : "border-amber-500/35 bg-amber-500/[0.06]",
                  )}
                >
                  <div>
                    <span className="font-semibold text-foreground">{a.type}</span>
                    <span className="text-muted-foreground"> · {a.nodeId}</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{a.message}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 shrink-0 gap-1"
                    onClick={onShowOnMap}
                    aria-label={`Show alert ${a.type} on map`}
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    Map
                  </Button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
        <p className={cn("text-[10px] text-zinc-500 border-t border-zinc-800/80 pt-2", typography.mono)}>
          Auto-reassign: mesh coordinator may reroute tasks when geofence or battery rules trip (see Vertex ledger).
        </p>
      </CardContent>
    </Card>
  );
}

export function BlackoutRecoveryPanel({ envelope }: { envelope: FlatMissionEnvelope }) {
  const agg = envelope.recovery;
  return (
    <Card variant="node" className="border-zinc-800">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Recovery & checkpoints</CardTitle>
        <CardDescription className="text-xs">
          Aggregate lag {agg.checkpointLag} events · map drift ~{agg.mapLagPct}%
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Fleet: {agg.state}</Badge>
        </div>
        <ul className="space-y-2">
          {envelope.nodes.map((n) => {
            const b = recoveryBadgeForHealth(n.health);
            return (
              <li key={n.nodeId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800/80 bg-zinc-950/50 px-2 py-2">
                <span className="font-mono text-[11px] text-foreground">{n.nodeId}</span>
                <Badge variant={b.variant} className="text-[10px]">
                  {b.label}
                </Badge>
                <span className="text-[10px] text-muted-foreground w-full sm:w-auto">
                  tasks {n.activeTasks} · trust {(n.trust * 100).toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-[10px] text-muted-foreground">
          Suggested actions: manual sync if stale, isolate noisy peer, or cap concurrent tasks during replay.
        </p>
      </CardContent>
    </Card>
  );
}

export function BlackoutTaskAllocationPanel({ view }: { view: VertexSwarmView | null }) {
  const detail = useMemo(() => {
    if (!view) return null;
    const t = view.tasks.find((x) => x.status === "assigned" && x.winnerNodeId);
    if (!t) return null;
    const winnerBid = t.bids.find((b) => b.nodeId === t.winnerNodeId);
    const top = [...t.bids].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3);
    return { task: t, winnerBid, top, narrative: t.assignmentReason };
  }, [view]);

  if (!detail) {
    return (
      <Card variant="mission" className="border-zinc-800">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Task allocation</CardTitle>
          <CardDescription className="text-xs">Waiting for an assigned task with sealed bids…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { task, winnerBid, top, narrative } = detail;
  const w = winnerBid;

  return (
    <Card variant="mission" className="border-zinc-800">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Explainable allocation</CardTitle>
        <CardDescription className="text-xs">
          {task.taskType} @ ({task.location.x.toFixed(0)}, {task.location.z.toFixed(0)})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="font-mono">Winner {task.winnerNodeId}</Badge>
          <span className="text-muted-foreground">score {(w?.score ?? 0).toFixed(2)}</span>
        </div>
        {w?.scoreReasons?.length ? (
          <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
            {w.scoreReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        ) : null}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Top candidates</p>
          <div className="space-y-1">
            {top.map((b, i) => (
              <div key={b.nodeId} className="flex justify-between gap-2 font-mono text-[11px]">
                <span>
                  #{i + 1} {b.nodeId}
                </span>
                <span>{(b.score ?? 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
        {narrative ? <p className="text-[11px] leading-relaxed text-sky-200/90 border-l-2 border-sky-500/50 pl-2">{narrative}</p> : null}
      </CardContent>
    </Card>
  );
}

export function BlackoutSettlementPanel({ envelope }: { envelope: FlatMissionEnvelope }) {
  const s = envelope.settlement;
  if (!s?.ready) return null;

  const exportJson = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            missionId: envelope.missionId,
            phase: envelope.phase,
            manifestHash: s.manifestHash,
            rewardPoolHint: envelope.nodes.length * 120,
            topContributors: envelope.nodes.slice(0, 3).map((n) => ({ nodeId: n.nodeId, role: n.role, trust: n.trust })),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reward-manifest-${envelope.missionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Reward manifest downloaded");
  };

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(s.manifestHash);
      toast.success("Hash copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <Card
      className="border-violet-500/35 bg-violet-500/[0.06]"
      style={{ borderColor: `${colors.settlement}55` }}
    >
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2" style={{ color: colors.settlement }}>
          Settlement
        </CardTitle>
        <CardDescription className="text-xs">Mission outcome — economic punchline visible.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <p>
          <span className="text-muted-foreground">Mission</span>{" "}
          <span className="font-mono text-foreground">{envelope.missionId}</span> · phase{" "}
          <strong>{envelope.phase}</strong>
        </p>
        <p className="leading-relaxed text-muted-foreground">
          Pool (demo): {envelope.nodes.length * 120} RP · checkpoint{" "}
          <code className="text-[10px] text-foreground">{s.manifestHash.slice(0, 18)}…</code>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="min-h-11 gap-1" onClick={() => void copyHash()} aria-label="Copy checkpoint hash">
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copy hash
          </Button>
          <Button type="button" size="sm" className="min-h-11 gap-1" onClick={exportJson} aria-label="Download reward manifest JSON">
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export manifest
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
