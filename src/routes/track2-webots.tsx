import { createFileRoute } from "@tanstack/react-router";
import { Track2WebotsLayout } from "@/components/Track2WebotsLayout";
import Track2WebotsHome from "@/pages/Track2WebotsHome";

export const Route = createFileRoute("/track2-webots")({
  component: () => (
    <Track2WebotsLayout>
      <Track2WebotsHome />
    </Track2WebotsLayout>
  ),
});
