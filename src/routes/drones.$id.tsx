import { createFileRoute } from "@tanstack/react-router";
import AgentDetailPage from "@/pages/dashboard/AgentDetail";

export const Route = createFileRoute("/drones/$id")({
  component: AgentDetailPage,
});
