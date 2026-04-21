import { createFileRoute } from "@tanstack/react-router";
import ArenaObstacleDemo from "@/pages/scenarios/ArenaObstacleDemo";

export const Route = createFileRoute("/scenarios/arena-obstacle")({
  component: ArenaObstacleDemo,
});
