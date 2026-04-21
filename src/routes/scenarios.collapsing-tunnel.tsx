import { createFileRoute } from "@tanstack/react-router";
import CollapsingTunnelDemo from "@/pages/scenarios/CollapsingTunnelDemo";

export const Route = createFileRoute("/scenarios/collapsing-tunnel")({
  component: CollapsingTunnelDemo,
});
