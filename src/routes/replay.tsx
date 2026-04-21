import { createFileRoute } from "@tanstack/react-router";
import ReplayPage from "@/pages/dashboard/Replay";

export const Route = createFileRoute("/replay")({
  component: ReplayPage,
});
