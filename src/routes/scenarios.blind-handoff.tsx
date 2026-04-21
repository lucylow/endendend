import { createFileRoute } from "@tanstack/react-router";
import { Track2WebotsLayout } from "@/components/Track2WebotsLayout";
import BlindHandoffScenario from "@/scenarios/blind-handoff";

export const Route = createFileRoute("/scenarios/blind-handoff")({
  component: () => (
    <Track2WebotsLayout>
      <BlindHandoffScenario />
    </Track2WebotsLayout>
  ),
});
