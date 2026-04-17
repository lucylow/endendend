import ArenaObstacleScenario from "@/scenarios/arena-obstacle/ArenaObstacleScenario";
import ScenarioDemoShell from "@/components/scenarios/ScenarioDemoShell";

export default function ArenaObstacleDemo() {
  return (
    <ScenarioDemoShell slug="arena-race" sarLink="/scenarios/search-rescue/arena-race" bgClass="bg-zinc-950">
      <ArenaObstacleScenario />
    </ScenarioDemoShell>
  );
}
