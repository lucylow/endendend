import ThermalRebalanceScenario from "@/scenarios/thermal-rebalance/ThermalRebalanceScenario";
import ScenarioDemoShell from "@/components/scenarios/ScenarioDemoShell";

export default function ThermalRebalanceDemo() {
  return (
    <ScenarioDemoShell slug="thermal-rebalance" sarLink="/scenarios/search-rescue/thermal-rebalance" bgClass="bg-zinc-950">
      <ThermalRebalanceScenario />
    </ScenarioDemoShell>
  );
}
