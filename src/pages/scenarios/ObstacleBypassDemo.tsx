import CircularBypassScenario from "@/scenarios/obstacle-bypass/CircularBypassScenario";
import ScenarioDemoShell from "@/components/scenarios/ScenarioDemoShell";

export default function ObstacleBypassDemo() {
  return (
    <ScenarioDemoShell slug="circular-bypass" sarLink="/scenarios/search-rescue/circular-bypass" bgClass="bg-black">
      <CircularBypassScenario />
    </ScenarioDemoShell>
  );
}
