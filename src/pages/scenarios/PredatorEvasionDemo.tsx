import ScenarioDemoShell from "@/components/scenarios/ScenarioDemoShell";
import PredatorEvasionScenario from "@/scenarios/predator-evasion/PredatorEvasionScenario";

export default function PredatorEvasionDemo() {
  return (
    <ScenarioDemoShell slug="predator-evasion" sarLink="/scenarios/search-rescue/predator-evasion">
      <PredatorEvasionScenario />
    </ScenarioDemoShell>
  );
}
