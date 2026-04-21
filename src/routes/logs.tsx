import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/logs")({
  component: LogsPage,
});

const sample = [
  { t: "INFO", m: "vertex: consensus round 812 committed", ts: "T+00:12:04" },
  { t: "WARN", m: "relay-2 elevated latency 180ms", ts: "T+00:12:06" },
  { t: "ERROR", m: "packet storm cleared after 240ms", ts: "T+00:12:09" },
  { t: "DEBUG", m: "foxmq: map shard 4 reconciled", ts: "T+00:12:11" },
];

function LogsPage() {
  const [filter, setFilter] = useState<"ALL" | "ERROR" | "WARN" | "INFO" | "DEBUG">("ALL");
  const rows = useMemo(
    () => (filter === "ALL" ? sample : sample.filter((r) => r.t === filter)),
    [filter],
  );

  return (
    <div className="flex h-[min(70vh,720px)] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-white">Mission logs</h1>
          <p className="text-xs text-zinc-500">Vertex / FoxMQ stream (mock)</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {(["ALL", "ERROR", "WARN", "INFO", "DEBUG"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "secondary" : "ghost"} className="h-8 text-xs" onClick={() => setFilter(f)}>
              {f}
            </Button>
          ))}
          <Button size="sm" variant="outline" className="h-8 border-white/15 text-xs">
            Export CSV
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3 backdrop-blur-xl">
        <ul className="space-y-2 font-mono text-[11px] text-zinc-300">
          {rows.map((r) => (
            <li key={r.ts + r.m} className="border-b border-white/5 pb-2">
              <span className="text-zinc-500">{r.ts}</span>{" "}
              <span className={r.t === "ERROR" ? "text-red-400" : r.t === "WARN" ? "text-amber-300" : "text-cyan-300"}>{r.t}</span>{" "}
              {r.m}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
