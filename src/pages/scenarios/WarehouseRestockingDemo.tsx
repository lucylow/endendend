import ScenarioDemoShell from "@/components/scenarios/ScenarioDemoShell";
import WarehouseRestockingScenario from "@/scenarios/warehouse-restocking/WarehouseRestockingScenario";

export default function WarehouseRestockingDemo() {
  return (
    <ScenarioDemoShell slug="warehouse-restock" bgClass="bg-zinc-950">
      <WarehouseRestockingScenario />
    </ScenarioDemoShell>
  );
}
