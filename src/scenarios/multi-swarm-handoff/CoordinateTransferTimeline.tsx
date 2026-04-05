import { cn } from "@/lib/utils";
import { useScenarioVizStore } from "@/store/scenarioVizStore";

const STEPS = [
  { key: "discover", label: "Swarm A discovers target" },
  { key: "foxmq", label: "FoxMQ: coords + stakes" },
  { key: "consensus", label: "Consensus (18ms class)" },
  { key: "adopt", label: "Swarm B: approach vector" },
] as const;

export default function CoordinateTransferTimeline() {
  const handoffActive = useScenarioVizStore((s) => s.handoffActive);

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-zinc-950/50 p-4 backdrop-blur-md">
      <h4 className="mb-3 text-xs font-mono uppercase tracking-widest text-cyan-500/80">Coordinate transfer</h4>
      <ol className="space-y-3">
        {STEPS.map((step, i) => {
          const complete = handoffActive;
          const current = !handoffActive && i === 0;
          return (
            <li key={step.key} className="flex gap-3 text-sm">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                  complete && "border-emerald-500/60 bg-emerald-500/20 text-emerald-300",
                  current && "border-cyan-500/60 bg-cyan-500/15 text-cyan-300",
                  !complete && !current && "border-zinc-700 text-zinc-600",
                )}
              >
                {complete ? "✓" : i + 1}
              </span>
              <span className={cn("leading-snug", complete || current ? "text-zinc-200" : "text-zinc-500")}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      {!handoffActive ? (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Auto-triggers when Swarm A enters the handoff radius, or use “Force FoxMQ handoff”.
        </p>
      ) : null}
    </div>
  );
}
