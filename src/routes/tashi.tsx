import { createFileRoute } from "@tanstack/react-router";
import TashiWorkspace from "@/pages/TashiWorkspace";

export const Route = createFileRoute("/tashi")({
  component: TashiWorkspace,
});
