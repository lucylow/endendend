import { createFileRoute } from "@tanstack/react-router";
import SearchRescueDemo from "@/pages/scenarios/SearchRescueDemo";

export const Route = createFileRoute("/scenarios/search-rescue/$scenarioSlug")({
  component: SearchRescueDemo,
});
