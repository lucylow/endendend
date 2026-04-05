import type { ScenarioBrief } from "@/lib/scenarios/scenarioBriefs";
import { Quote } from "lucide-react";

const rows: { key: keyof Pick<ScenarioBrief, "setup" | "emergentBehavior" | "successMetric" | "failureMode">; label: string }[] = [
  { key: "setup", label: "Setup" },
  { key: "emergentBehavior", label: "Emergent behavior" },
  { key: "successMetric", label: "Success metric" },
  { key: "failureMode", label: "Failure mode" },
];

export default function ScenarioBriefPanel({ brief }: { brief: ScenarioBrief }) {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/25 via-background/40 to-violet-950/20 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground tracking-tight">Leaderless scenario brief</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Tashi Vertex + FoxMQ · production-style test narrative (no cloud planner).
          </p>
        </div>
      </div>

      <dl className="space-y-3 text-sm">
        {rows.map(({ key, label }) => (
          <div key={key}>
            <dt className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/90 mb-0.5">{label}</dt>
            <dd className="text-muted-foreground leading-relaxed text-xs">{brief[key]}</dd>
          </div>
        ))}
        {brief.tashiNote ? (
          <div>
            <dt className="text-[10px] font-mono uppercase tracking-wider text-violet-400/90 mb-0.5">Tashi / Vertex angle</dt>
            <dd className="text-muted-foreground leading-relaxed text-xs">{brief.tashiNote}</dd>
          </div>
        ) : null}
      </dl>

      {brief.demoTiming && brief.demoTiming.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border/60 bg-background/30 p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Demo timing</p>
          <ol className="list-decimal pl-4 space-y-1 text-xs text-muted-foreground leading-relaxed">
            {brief.demoTiming.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {brief.judgeQuote ? (
        <blockquote className="mt-4 flex gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs italic text-foreground/90 leading-relaxed">
          <Quote className="h-4 w-4 shrink-0 text-emerald-500/70 mt-0.5" aria-hidden />
          <span>“{brief.judgeQuote}”</span>
        </blockquote>
      ) : null}
    </div>
  );
}
