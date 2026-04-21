import { memo, useMemo, useState } from "react";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SortKey = "nodeId" | "at" | "battery" | "trust" | "link" | "depth";

export const TelemetryLiveTable = memo(function TelemetryLiveTable({ view }: { view: VertexSwarmView | null }) {
  const [sortKey, setSortKey] = useState<SortKey>("nodeId");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const rows = useMemo(() => {
    if (!view) return [];
    return view.nodes.map((n) => {
      const tel = view.telemetry.find((t) => t.nodeId === n.nodeId);
      return {
        nodeId: n.nodeId,
        at: tel?.receivedAtMs ?? view.nowMs,
        battery: tel?.battery01 ?? 0,
        trust: n.trust01,
        link: tel?.link01 ?? 0,
        depth: n.position.y,
      };
    });
  }, [view]);

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const c = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : (av as number) - (bv as number);
      return dir === "asc" ? c : -c;
    });
    return out;
  }, [rows, sortKey, dir]);

  const toggle = (k: SortKey) => {
    if (sortKey === k) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setDir("asc");
    }
  };

  const th = (k: SortKey, label: string) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("h-9 px-2 text-[10px] font-mono uppercase", sortKey === k && "text-primary")}
      onClick={() => toggle(k)}
    >
      {label}
      {sortKey === k ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </Button>
  );

  return (
    <Card variant="node" className="border-zinc-800">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Live telemetry</CardTitle>
        <CardDescription className="text-xs">Latest row per drone — sortable.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-left text-[11px] font-mono">
          <thead className="border-b border-zinc-800 bg-zinc-950/60">
            <tr>
              <th className="p-2">{th("nodeId", "Drone")}</th>
              <th className="p-2">{th("at", "Timestamp")}</th>
              <th className="p-2">{th("battery", "Battery")}</th>
              <th className="p-2">{th("trust", "Trust")}</th>
              <th className="p-2">{th("link", "Link")}</th>
              <th className="p-2">{th("depth", "Depth (Y)")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.nodeId} className="border-b border-zinc-800/60 hover:bg-zinc-900/40">
                <td className="p-2 text-foreground">{r.nodeId}</td>
                <td className="p-2 text-muted-foreground">{new Date(r.at).toLocaleTimeString()}</td>
                <td className="p-2">{(r.battery * 100).toFixed(0)}%</td>
                <td className="p-2">{(r.trust * 100).toFixed(0)}%</td>
                <td className="p-2">{(r.link * 100).toFixed(0)}%</td>
                <td className="p-2">{r.depth.toFixed(1)} m</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!view ? <p className="p-4 text-xs text-muted-foreground">Waiting for simulator…</p> : null}
      </CardContent>
    </Card>
  );
});
