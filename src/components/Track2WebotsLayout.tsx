import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import WebotsBridge from "@/components/WebotsBridge";
import ScenarioControls from "@/components/ScenarioControls";
import LiveDashboard from "@/components/LiveDashboard";
import { useSwarmStore } from "@/stores/swarmStore";

export function Track2WebotsLayout() {
  const location = useLocation();
  const setScenario = useSwarmStore((s) => s.setScenario);

  useEffect(() => {
    const p = location.pathname;
    if (p.includes("/scenarios/fallen")) setScenario("fallen");
    else if (p.includes("/scenarios/handoff")) setScenario("handoff");
    else if (p.includes("/scenarios/daisy")) setScenario("daisy");
  }, [location.pathname, setScenario]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <WebotsBridge />
      <ScenarioControls />
      <LiveDashboard />
      <Outlet />
    </div>
  );
}
