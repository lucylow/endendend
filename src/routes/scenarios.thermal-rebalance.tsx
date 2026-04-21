import { createFileRoute } from "@tanstack/react-router";
import ThermalRebalanceDemo from "@/pages/scenarios/ThermalRebalanceDemo";

export const Route = createFileRoute("/scenarios/thermal-rebalance")({
  component: ThermalRebalanceDemo,
});
