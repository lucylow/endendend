import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import MultiSwarmHandoffScenario from "@/scenarios/multi-swarm-handoff/MultiSwarmHandoffScenario";
import { useScenarioVizStore } from "@/store/scenarioVizStore";
import { useSwarmStore } from "@/store/swarmStore";

export default function MultiSwarmHandoffDemo() {
  const initMultiSwarmHandoff = useScenarioVizStore((s) => s.initMultiSwarmHandoff);
  const startSimulation = useSwarmStore((s) => s.startSimulation);

  useEffect(() => {
    initMultiSwarmHandoff();
    startSimulation();
  }, [initMultiSwarmHandoff, startSimulation]);

  return (
    <div className="min-h-screen bg-zinc-950 text-foreground">
      <header className="sticky top-0 z-50 border-b border-zinc-800/70 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
          <Button variant="ghost" size="sm" asChild className="gap-2 text-zinc-400 hover:text-foreground">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="border-zinc-700 text-xs">
            <Link to="/scenarios/search-rescue/multi-swarm-handoff">
              <LifeBuoy className="mr-1.5 h-3.5 w-3.5" />
              SAR index
            </Link>
          </Button>
        </div>
      </header>
      <MultiSwarmHandoffScenario />
    </div>
  );
}
