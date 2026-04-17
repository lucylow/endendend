import ScenarioDemoShell from "@/components/scenarios/ScenarioDemoShell";
import RandomFailureScenario from "@/scenarios/random-failure/RandomFailureScenario";

export default function RandomFailureDemo() {
  return (
    <ScenarioDemoShell slug="random-failure" sarLink="/scenarios/search-rescue/random-failure">
      <RandomFailureScenario />
    </ScenarioDemoShell>
  );
}
