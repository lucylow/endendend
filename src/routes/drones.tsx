import { createFileRoute } from "@tanstack/react-router";
import AgentsPage from "@/pages/dashboard/Agents";

export const Route = createFileRoute("/drones")({
  component: AgentsPage,
});
