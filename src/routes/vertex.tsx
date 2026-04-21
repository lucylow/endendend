import { createFileRoute } from "@tanstack/react-router";
import VertexSwarmPage from "@/pages/dashboard/VertexSwarm";

export const Route = createFileRoute("/vertex")({
  component: VertexSwarmPage,
});
