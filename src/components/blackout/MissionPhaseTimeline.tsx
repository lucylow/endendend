import { memo, useCallback, useMemo, useState } from "react";
import { MISSION_PHASES, type MissionPhase } from "@/backend/shared/mission-phases";
import type { SwarmRuntimeEvent } from "@/swarm/swarmEventStream";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const PHASE_COLOR: Record<string, string> = {
  init: "bg-zinc-500",
  discovery: "bg-cyan-500",
  search: "bg-emerald-500",
  triage: "bg-amber-500",
  rescue: "bg-orange-500",
  extraction: "bg-red-500",
  return: "bg-violet-600",
  complete: "bg-blue-500",
  aborted: "bg-rose-700",
};

const LINEAR = MISSION_PHASES.filter((p) => p !== "aborted");

export const MissionPhaseTimeline = memo(function MissionPhaseTimeline({
  phase,
  runtimeEvents,
  missionStartMs,
  nowMs,
  onScrubToMs,
}: {
  phase: MissionPhase;
  runtimeEvents: SwarmRuntimeEvent[];
  missionStartMs: number;
  nowMs: number;
  onScrubToMs?: (ms: number) => void;
}) {
  const [pick, setPick] = useState<number | null>(null);

  const phaseIndex = useMemo(() => Math.max(0, LINEAR.indexOf(phase)), [phase]);

  const dots = useMemo(() => {
    const span = Math.max(1, nowMs - missionStartMs);
    return runtimeEvents
      .filter((e) => e.kind === "target" || e.kind === "role" || e.kind === "mesh")
      .slice(0, 40)
      .map((e) => ({
        id: e.id,
        at: e.atMs,
        label: e.label,
        x01: Math.min(1, Math.max(0, (e.atMs - missionStartMs) / span)),
      }));
  }, [runtimeEvents, missionStartMs, nowMs]);

  const exportJson = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            phase,
            linearPhases: LINEAR,
            events: runtimeEvents.slice(0, 200),
            exportedAt: Date.now(),
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
    a.download = "mission-timeline.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Timeline JSON exported");
  };

  const exportPng = useCallback(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 880;
    canvas.height = 140;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width / LINEAR.length;
    LINEAR.forEach((p, i) => {
      const col = PHASE_COLOR[p]?.replace("bg-", "") ?? "zinc-600";
      const colors: Record<string, string> = {
        "cyan-500": "#06b6d4",
        "emerald-500": "#10b981",
        "amber-500": "#f59e0b",
        "orange-500": "#f97316",
        "red-500": "#ef4444",
        "violet-600": "#7c3aed",
        "blue-500": "#3b82f6",
        "zinc-500": "#71717a",
      };
      const hex = colors[col] ?? "#52525b";
      ctx.fillStyle = p === phase ? hex : `${hex}99`;
      ctx.fillRect(8 + i * w, 40, w - 6, 48);
      ctx.fillStyle = "#e4e4e7";
      ctx.font = "11px monospace";
      ctx.fillText(p, 12 + i * w, 30);
    });
    ctx.fillStyle = "#fafafa";
    ctx.font = "10px monospace";
    ctx.fillText(`cursor: ${pick ?? "—"}`, 12, 118);
    canvas.toBlob((b) => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mission-timeline.png";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Timeline PNG exported");
    });
  }, [phase, pick]);

  return (
    <Card variant="mission" className="border-zinc-800" data-tour="timeline">
      <CardHeader className="py-3 flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="text-sm">Mission timeline</CardTitle>
          <CardDescription className="text-xs">Gantt phases · click a block to scrub (local cursor)</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" className="min-h-11 text-xs" onClick={exportJson}>
            Export JSON
          </Button>
          <Button type="button" size="sm" variant="secondary" className="min-h-11 text-xs" onClick={exportPng}>
            Export PNG
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full rounded-md border border-zinc-800/80 bg-zinc-950/40">
          <div className="min-w-[720px] p-4 space-y-3">
            <div className="relative h-14 flex gap-1">
              {LINEAR.map((p, i) => {
                const active = i <= phaseIndex;
                return (
                  <button
                    key={p}
                    type="button"
                    className={`flex-1 rounded-md border border-zinc-800/80 text-[10px] font-mono uppercase transition ${PHASE_COLOR[p] ?? "bg-zinc-600"} ${
                      active ? "opacity-100 ring-1 ring-primary/40" : "opacity-35"
                    }`}
                    onClick={() => {
                      const t = missionStartMs + (i / LINEAR.length) * (nowMs - missionStartMs);
                      setPick(t);
                      onScrubToMs?.(t);
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <div className="relative h-6 rounded bg-zinc-900/80 border border-zinc-800">
              {dots.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  title={d.label}
                  className="absolute top-1 h-4 w-4 rounded-full bg-sky-400 border border-sky-200 -translate-x-1/2 hover:scale-110"
                  style={{ left: `${8 + d.x01 * 84}%` }}
                  onClick={() => {
                    setPick(d.at);
                    onScrubToMs?.(d.at);
                  }}
                />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground font-mono">
              Scrub target: {pick ? new Date(pick).toLocaleTimeString() : "—"} · events: {runtimeEvents.length}
            </p>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
});
