import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/features/health/types";

const label: Record<HealthStatus, string> = {
  healthy: "OK",
  warning: "Warn",
  degraded: "Degraded",
  critical: "Critical",
  offline: "Offline",
};

const styles: Record<HealthStatus, string> = {
  healthy: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  warning: "border-amber-500/45 bg-amber-500/15 text-amber-100",
  degraded: "border-orange-500/45 bg-orange-500/15 text-orange-100",
  critical: "border-red-500/50 bg-red-500/20 text-red-100 animate-pulse",
  offline: "border-zinc-600 bg-zinc-800/80 text-zinc-400",
};

export interface HealthBadgeProps {
  status: HealthStatus;
  className?: string;
  compact?: boolean;
}

export function HealthBadge({ status, className, compact }: HealthBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
        styles[status],
        compact && "px-1.5 py-0 text-[9px]",
        className,
      )}
    >
      {label[status]}
    </span>
  );
}
