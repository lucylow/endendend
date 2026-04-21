import { createFileRoute } from "@tanstack/react-router";
import StakeVotingDemo from "@/pages/scenarios/StakeVotingDemo";

export const Route = createFileRoute("/scenarios/stake-voting")({
  component: StakeVotingDemo,
});
