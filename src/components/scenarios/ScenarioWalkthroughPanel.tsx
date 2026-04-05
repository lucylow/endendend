import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Eye, Target, CheckCircle2, Play, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScenarioWalkthrough, WalkthroughPhase } from "@/lib/scenarios/scenarioWalkthroughs";

function PhaseStep({ phase, index, isActive, onToggle }: {
  phase: WalkthroughPhase;
  index: number;
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      {/* Timeline connector */}
      <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border/40" />

      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-start gap-3 text-left rounded-xl px-3 py-2.5 transition-all duration-200",
          isActive
            ? "bg-primary/[0.08] border border-primary/20"
            : "hover:bg-muted/30 border border-transparent"
        )}
      >
        {/* Step number */}
        <div className={cn(
          "relative z-10 flex items-center justify-center w-[30px] h-[30px] rounded-lg text-xs font-mono font-bold shrink-0 transition-colors",
          isActive
            ? "bg-primary/20 text-primary border border-primary/30"
            : "bg-muted/50 text-muted-foreground border border-border/50"
        )}>
          {index + 1}
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={cn(
                "font-semibold text-sm transition-colors",
                isActive ? "text-foreground" : "text-foreground/80"
              )}>
                {phase.title}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">
                {phase.time}
              </span>
            </div>
            {isActive ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
          </div>

          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                  {phase.description}
                </p>
                <div className="flex items-start gap-1.5 mt-2 rounded-lg bg-accent/[0.06] border border-accent/15 px-2.5 py-2">
                  <Eye className="w-3 h-3 text-accent shrink-0 mt-0.5" />
                  <p className="text-[11px] text-accent/90 leading-relaxed">
                    <span className="font-semibold">Watch for:</span> {phase.watchFor}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </button>
    </div>
  );
}

export default function ScenarioWalkthroughPanel({ walkthrough, className }: {
  walkthrough: ScenarioWalkthrough;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [activePhase, setActivePhase] = useState<number | null>(0);

  return (
    <div className={cn(
      "rounded-2xl border border-primary/15 bg-gradient-to-br from-card/80 via-card/60 to-card/40 backdrop-blur-md overflow-hidden",
      className
    )}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20">
            <Info className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground">Scenario Guide</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono uppercase tracking-wider">
              {walkthrough.phases.length} phases · follow along
            </p>
          </div>
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 text-muted-foreground transition-transform",
          isOpen ? "rotate-0" : "-rotate-90"
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Purpose */}
              <div className="rounded-xl bg-muted/20 border border-border/40 px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Play className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-primary/80">Purpose</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{walkthrough.purpose}</p>
              </div>

              {/* Success criteria */}
              <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/90">Success looks like</span>
                </div>
                <p className="text-xs text-emerald-200/80 leading-relaxed">{walkthrough.successCriteria}</p>
              </div>

              {/* Phase timeline */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 px-1">
                  Mission phases
                </p>
                <div className="space-y-1">
                  {walkthrough.phases.map((phase, i) => (
                    <PhaseStep
                      key={phase.title}
                      phase={phase}
                      index={i}
                      isActive={activePhase === i}
                      onToggle={() => setActivePhase(activePhase === i ? null : i)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
