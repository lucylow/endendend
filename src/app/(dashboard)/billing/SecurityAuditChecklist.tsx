import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ATTACK_SURFACE_PRIORITY,
  MONETIZATION_SECURITY,
  MONETIZATION_SECURITY_AUDIT,
  type AuditImplementation,
  type AuditSeverity,
} from "@/lib/monetization/security";
import { cn } from "@/lib/utils";
import { ChevronDown, ClipboardList, ShieldAlert } from "lucide-react";

function severityClass(s: AuditSeverity): string {
  switch (s) {
    case "critical":
      return "border-rose-500/40 bg-rose-500/10 text-rose-200";
    case "high":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    case "medium":
      return "border-cyan-500/35 bg-cyan-500/10 text-cyan-200";
    default:
      return "border-border bg-muted/30 text-muted-foreground";
  }
}

function implementationLabel(i: AuditImplementation): string {
  switch (i) {
    case "in_repo":
      return "In repo";
    case "partial":
      return "Partial";
    default:
      return "Policy / roadmap";
  }
}

function implementationClass(i: AuditImplementation): string {
  switch (i) {
    case "in_repo":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    case "partial":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    default:
      return "border-border bg-muted/25 text-muted-foreground";
  }
}

export function SecurityAuditChecklist() {
  const [openId, setOpenId] = useState<string | null>("prelaunch");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
          <ClipboardList className="h-5 w-5 text-violet-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-foreground">Security audit checklist</h2>
          <p className="text-sm text-muted-foreground">
            Monetized robot swarm coordination: consensus, payments, physical safety, and incident response. This panel
            is an internal readiness guide — not a certification badge. Pass production gates only with your auditor,
            insurer, and legal counsel.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2 font-medium text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Red flags for demo or degraded mode
        </span>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Stake concentration or flash-loan spikes without explanation</li>
          <li>
            Consensus latency above {MONETIZATION_SECURITY.consensusLatencyCriticalMs}ms sustained or unexplained
            partitions
          </li>
          <li>Physical boundary breach or lidar tamper alerts</li>
          <li>Stripe dispute or fraud signals without containment playbook</li>
        </ul>
      </div>

      <div className="space-y-3">
        {MONETIZATION_SECURITY_AUDIT.map((phase) => {
          const isOpen = openId === phase.id;
          return (
            <Collapsible
              key={phase.id}
              open={isOpen}
              onOpenChange={(o) => setOpenId(o ? phase.id : null)}
              className="rounded-xl border border-border bg-card/30 ring-1 ring-border/40"
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/20">
                <div>
                  <p className="font-semibold text-foreground">{phase.title}</p>
                  <p className="text-xs text-muted-foreground">{phase.subtitle}</p>
                </div>
                <ChevronDown
                  className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="space-y-3 border-t border-border/60 px-4 py-4">
                  {phase.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-border/50 bg-background/40 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{item.title}</span>
                        <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wide", severityClass(item.severity))}>
                          {item.severity}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] uppercase tracking-wide", implementationClass(item.implementation))}
                        >
                          {implementationLabel(item.implementation)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      <Card className="border-border bg-card/35">
        <CardHeader>
          <CardTitle className="text-base">Attack surface prioritization</CardTitle>
          <CardDescription>Order of remediation for monetized coordination and field robots.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            {ATTACK_SURFACE_PRIORITY.map((row) => (
              <li
                key={row.rank}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border border-border/40 bg-muted/15 px-3 py-2"
              >
                <span className="font-mono text-xs text-muted-foreground">#{row.rank}</span>
                <span className="font-medium text-foreground">{row.title}</span>
                <Badge variant="outline" className={cn("text-[10px]", severityClass(row.severity))}>
                  {row.severity}
                </Badge>
                <span className="w-full text-muted-foreground sm:w-auto sm:flex-1">→ {row.mitigation}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
