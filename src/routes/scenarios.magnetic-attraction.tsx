import { createFileRoute } from "@tanstack/react-router";
import MagneticAttractionDemo from "@/pages/scenarios/MagneticAttractionDemo";

export const Route = createFileRoute("/scenarios/magnetic-attraction")({
  component: MagneticAttractionDemo,
});
