import { createFileRoute } from "@tanstack/react-router";
import { Track2WebotsLayout } from "@/components/Track2WebotsLayout";
import BlindHandoffViz from "@/scenarios/BlindHandoffViz";

export const Route = createFileRoute("/scenarios/handoff")({
  component: () => (
    <Track2WebotsLayout>
      <BlindHandoffViz />
    </Track2WebotsLayout>
  ),
});
