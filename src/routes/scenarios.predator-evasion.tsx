import { createFileRoute } from "@tanstack/react-router";
import PredatorEvasionDemo from "@/pages/scenarios/PredatorEvasionDemo";

export const Route = createFileRoute("/scenarios/predator-evasion")({
  component: PredatorEvasionDemo,
});
