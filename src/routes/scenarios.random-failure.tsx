import { createFileRoute } from "@tanstack/react-router";
import RandomFailureDemo from "@/pages/scenarios/RandomFailureDemo";

export const Route = createFileRoute("/scenarios/random-failure")({
  component: RandomFailureDemo,
});
