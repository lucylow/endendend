import { createFileRoute } from "@tanstack/react-router";
import WarehouseRestockingDemo from "@/pages/scenarios/WarehouseRestockingDemo";

export const Route = createFileRoute("/scenarios/warehouse-restock")({
  component: WarehouseRestockingDemo,
});
