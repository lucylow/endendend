import ScenarioDemoShell from "@/components/scenarios/ScenarioDemoShell";
import BatteryCascadeScenario from "@/scenarios/battery-cascade/BatteryCascadeScenario";

export default function BatteryCascadeDemo() {
  return (
    <ScenarioDemoShell slug="battery-cascade" sarLink="/scenarios/search-rescue/battery-cascade">
      <BatteryCascadeScenario />
    </ScenarioDemoShell>
  );
}
