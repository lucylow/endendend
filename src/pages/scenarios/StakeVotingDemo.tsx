import ScenarioDemoShell from "@/components/scenarios/ScenarioDemoShell";
import StakeVotingScenario from "@/scenarios/stake-voting/StakeVotingScenario";

export default function StakeVotingDemo() {
  return (
    <ScenarioDemoShell slug="stake-voting" sarLink="/scenarios/search-rescue/stake-voting">
      <StakeVotingScenario />
    </ScenarioDemoShell>
  );
}
