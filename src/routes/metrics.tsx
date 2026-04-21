import { createFileRoute } from "@tanstack/react-router";
import AnalyticsPage from "@/pages/dashboard/Analytics";

export const Route = createFileRoute("/metrics")({
  component: AnalyticsPage,
});
