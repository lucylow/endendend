import { createFileRoute } from "@tanstack/react-router";
import { LiveSwarmPage } from "@/pages/mission/LiveSwarmPage";

export const Route = createFileRoute("/swarm")({
  component: LiveSwarmPage,
});
