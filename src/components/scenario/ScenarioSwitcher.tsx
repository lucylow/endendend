import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Flame, Waves, ShieldAlert, Mountain } from "lucide-react";

export type ScenarioKey =
  | "collapsed_building"
  | "wildfire"
  | "flood_rescue"
  | "hazmat"
  | "tunnel";

const scenarios: {
  key: ScenarioKey;
  label: string;
  icon: any;
  accent: string;
}[] = [
  { key: "collapsed_building", label: "Collapsed Building", icon: Building2, accent: "text-orange-400" },
  { key: "wildfire", label: "Wildfire", icon: Flame, accent: "text-red-400" },
  { key: "flood_rescue", label: "Flood Rescue", icon: Waves, accent: "text-blue-400" },
  { key: "hazmat", label: "Hazmat", icon: ShieldAlert, accent: "text-yellow-400" },
  { key: "tunnel", label: "Tunnel", icon: Mountain, accent: "text-emerald-400" },
];

export function ScenarioSwitcher({
  activeScenario,
  onChange,
}: {
  activeScenario: ScenarioKey;
  onChange: (scenario: ScenarioKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {scenarios.map(({ key, label, icon: Icon, accent }) => {
        const active = key === activeScenario;
        return (
          <Button
            key={key}
            variant={active ? "default" : "outline"}
            onClick={() => onChange(key)}
            className={`gap-2 transition-all ${active ? "" : "opacity-75 hover:opacity-100"}`}
          >
            <Icon className={`h-4 w-4 ${active ? "" : accent}`} />
            <span>{label}</span>
            {active && <Badge className="ml-1">Active</Badge>}
          </Button>
        );
      })}
    </div>
  );
}
