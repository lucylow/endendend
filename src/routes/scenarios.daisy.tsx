import { createFileRoute } from "@tanstack/react-router";
import { Track2WebotsLayout } from "@/components/Track2WebotsLayout";
import DaisyChainViz from "@/scenarios/DaisyChainViz";

export const Route = createFileRoute("/scenarios/daisy")({
  component: () => (
    <Track2WebotsLayout>
      <DaisyChainViz />
    </Track2WebotsLayout>
  ),
});
