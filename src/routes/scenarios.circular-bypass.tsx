import { createFileRoute } from "@tanstack/react-router";
import ObstacleBypassDemo from "@/pages/scenarios/ObstacleBypassDemo";

export const Route = createFileRoute("/scenarios/circular-bypass")({
  component: ObstacleBypassDemo,
});
