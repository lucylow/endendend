import { useState } from "react";
import { ScenarioWorkspace } from "./ScenarioWorkspace";
import { ScenarioKey } from "@/components/scenario/ScenarioSwitcher";
import { useRealtimeMission } from "@/hooks/useRealtimeMission";

export default function TashiWorkspace() {
  const [scenario, setScenario] = useState<ScenarioKey>("collapsed_building");
  useRealtimeMission(scenario);

  return <ScenarioWorkspace scenario={scenario} onScenarioChange={setScenario} />;
}
