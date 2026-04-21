import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import { Building2, Flame, Waves, ShieldAlert, Mountain } from "lucide-react";
import { spacing, typography, chrome } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

export type ScenarioKey =
  | "collapsed_building"
  | "wildfire"
  | "flood_rescue"
  | "hazmat"
  | "tunnel";

const scenarios: {
  key: ScenarioKey;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  accent: string;
}[] = [
  { key: "collapsed_building", label: "Collapsed Building", shortLabel: "Building", icon: Building2, accent: "text-orange-400" },
  { key: "wildfire", label: "Wildfire", shortLabel: "Wildfire", icon: Flame, accent: "text-red-400" },
  { key: "flood_rescue", label: "Flood Rescue", shortLabel: "Flood", icon: Waves, accent: "text-sky-400" },
  { key: "hazmat", label: "Hazmat", shortLabel: "Hazmat", icon: ShieldAlert, accent: "text-amber-400" },
  { key: "tunnel", label: "Tunnel", shortLabel: "Tunnel", icon: Mountain, accent: "text-emerald-400" },
];

export function ScenarioSwitcher({
  activeScenario,
  onChange,
}: {
  /** Current sim scenario (may be a non-workspace preset until the operator picks one). */
  activeScenario: string;
  onChange: (scenario: ScenarioKey) => void;
}) {
  return (
    <nav className={cn("flex flex-wrap gap-2", typography.sans)} aria-label="Mission scenario">
      {scenarios.map(({ key, label, shortLabel, icon: Icon, accent }) => {
        const active = key === activeScenario;
        return (
          <Button
            key={key}
            type="button"
            variant={active ? "default" : "outline"}
            onClick={() => onChange(key)}
            aria-pressed={active}
            aria-label={`${active ? "Active scenario: " : "Switch to "}${label}`}
            className={cn(
              "gap-2 transition-all min-h-11 px-3 sm:px-4",
              spacing.touchMin,
              chrome.focusRing,
              active ? "" : "opacity-80 hover:opacity-100 border-zinc-700",
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active ? "" : accent)} aria-hidden />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
            {active ? (
              <Badge className="ml-1 hidden md:inline-flex" variant="secondary">
                Active
              </Badge>
            ) : null}
          </Button>
        );
      })}
    </nav>
  );
}
