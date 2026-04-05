import { Button } from "@/components/ui/button";
import { useScenarioVizStore } from "@/store/scenarioVizStore";

export default function HandoverControls() {
  const handoffActive = useScenarioVizStore((s) => s.handoffActive);
  const triggerHandoff = useScenarioVizStore((s) => s.triggerHandoff);
  const initMultiSwarmHandoff = useScenarioVizStore((s) => s.initMultiSwarmHandoff);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="text-xs shrink-0 border-zinc-600"
        onClick={() => initMultiSwarmHandoff()}
      >
        Reset demo
      </Button>
      <Button
        type="button"
        size="sm"
        variant={handoffActive ? "secondary" : "default"}
        className="text-xs shrink-0 bg-cyan-600 hover:bg-cyan-500"
        disabled={handoffActive}
        onClick={() => triggerHandoff()}
      >
        {handoffActive ? "Handoff complete" : "Force FoxMQ handoff"}
      </Button>
    </div>
  );
}
