import { useEffect, type ReactNode } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import WebotsBridge from "@/components/WebotsBridge";
import ScenarioControls from "@/components/ScenarioControls";
import LiveDashboard from "@/components/LiveDashboard";
import { useSwarmStore } from "@/stores/swarmStore";

export function Track2WebotsLayout({ children }: { children?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const setScenario = useSwarmStore((s) => s.setScenario);

  useEffect(() => {
    const p = pathname;
    if (p.includes("/scenarios/fallen")) setScenario("fallen");
    else if (p.includes("/scenarios/blind-handoff") || p.includes("/scenarios/handoff")) setScenario("handoff");
    else if (p.includes("/scenarios/daisy")) setScenario("daisy");
  }, [pathname, setScenario]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <WebotsBridge />
      <ScenarioControls />
      <LiveDashboard />
      <div className="absolute inset-0 z-0 h-full w-full min-h-0">{children ?? <Outlet />}</div>
    </div>
  );
}
