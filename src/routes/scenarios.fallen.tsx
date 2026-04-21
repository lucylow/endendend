import { createFileRoute } from "@tanstack/react-router";
import { Track2WebotsLayout } from "@/components/Track2WebotsLayout";
import FallenComradeViz from "@/scenarios/FallenComradeViz";

export const Route = createFileRoute("/scenarios/fallen")({
  component: () => (
    <Track2WebotsLayout>
      <FallenComradeViz />
    </Track2WebotsLayout>
  ),
});
