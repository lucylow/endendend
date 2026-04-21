import { createFileRoute } from "@tanstack/react-router";
import { DroneDetailPage } from "@/pages/mission/DroneDetailPage";

export const Route = createFileRoute("/drone/$id")({
  component: DroneDetailPage,
});
