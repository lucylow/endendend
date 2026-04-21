import { createFileRoute } from "@tanstack/react-router";
import SettingsPage from "@/pages/dashboard/Settings";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
