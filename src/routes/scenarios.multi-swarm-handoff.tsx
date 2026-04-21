import { createFileRoute } from "@tanstack/react-router";
import MultiSwarmHandoffDemo from "@/pages/scenarios/MultiSwarmHandoffDemo";

export const Route = createFileRoute("/scenarios/multi-swarm-handoff")({
  component: MultiSwarmHandoffDemo,
});
