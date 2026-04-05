import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSwarmStore } from "@/store/swarmStore";
import { cn } from "@/lib/utils";
import { Bot, Pause, Play } from "lucide-react";
import { HealthBadge } from "@/components/health/HealthBadge";
import { AgentHealthPanel } from "@/components/health/AgentHealthPanel";

export default function AgentList() {
  const agents = useSwarmStore((s) => s.agents);
  const selectedAgentId = useSwarmStore((s) => s.selectedAgentId);
  const selectAgent = useSwarmStore((s) => s.selectAgent);
  const isRunning = useSwarmStore((s) => s.isRunning);
  const startSimulation = useSwarmStore((s) => s.startSimulation);
  const pauseSimulation = useSwarmStore((s) => s.pauseSimulation);

  return (
    <motion.aside
      className="absolute bottom-4 right-4 top-20 z-40 flex w-[min(100%,18rem)] flex-col overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/92 shadow-2xl backdrop-blur-xl sm:bottom-6 sm:right-6 sm:top-24"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="border-b border-zinc-800/80 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-teal-400" />
            <span className="text-sm font-semibold text-zinc-100">Agents</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 border-zinc-700 px-2 text-[10px]"
            onClick={() => (isRunning ? pauseSimulation() : startSimulation())}
          >
            {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {isRunning ? "Pause" : "Run"}
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-zinc-500">Select to highlight in the scene</p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <ul className="space-y-1 p-2">
          {agents.map((agent) => {
            const selected = selectedAgentId === agent.id;
            return (
              <li key={agent.id}>
                <button
                  type="button"
                  onClick={() => selectAgent(selected ? null : agent.id)}
                  className={cn(
                    "flex w-full flex-col gap-1.5 rounded-xl px-3 py-2.5 text-left transition-colors",
                    selected ? "bg-teal-500/15 ring-1 ring-teal-500/40" : "hover:bg-zinc-900/80",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-zinc-100">{agent.name}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <HealthBadge status={agent.healthStatus ?? "healthy"} compact />
                      <span className="font-mono text-[10px] uppercase text-zinc-500">{agent.role}</span>
                    </div>
                  </div>
                  <Progress value={agent.battery} className="h-1 bg-zinc-800" />
                  <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                    <span>{agent.battery.toFixed(0)}%</span>
                    <span>{Math.round(agent.latency)}ms</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
      <AgentHealthPanel />
    </motion.aside>
  );
}
