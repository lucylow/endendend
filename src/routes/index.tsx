import { createFileRoute } from "@tanstack/react-router";
import { MissionLandingPage } from "@/pages/mission/MissionLandingPage";

export const Route = createFileRoute("/")({
  component: MissionLandingPage,
});
