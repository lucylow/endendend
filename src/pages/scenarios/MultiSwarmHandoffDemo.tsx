import { useEffect } from "react";
import MultiSwarmHandoffScenario from "@/scenarios/multi-swarm-handoff/MultiSwarmHandoffScenario";
import ScenarioDemoShell from "@/components/scenarios/ScenarioDemoShell";
import { useScenarioVizStore } from "@/store/scenarioVizStore";
import { useSwarmStore } from "@/store/swarmStore";

export default function MultiSwarmHandoffDemo() {
  const initMultiSwarmHandoff = useScenarioVizStore((s) => s.initMultiSwarmHandoff);
  const startSimulation = useSwarmStore((s) => s.startSimulation);

  useEffect(() => {
    initMultiSwarmHandoff();
    startSimulation();
  }, [initMultiSwarmHandoff, startSimulation]);

  return (
    <ScenarioDemoShell slug="multi-swarm-handoff" sarLink="/scenarios/search-rescue/multi-swarm-handoff" bgClass="bg-zinc-950">
      <MultiSwarmHandoffScenario />
    </ScenarioDemoShell>
  );
}
