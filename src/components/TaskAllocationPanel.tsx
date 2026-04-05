import { motion } from "framer-motion";
import { useSwarmStore } from "@/store/swarmStore";
import { ClipboardList } from "lucide-react";

const statusColors: Record<string, string> = {
  announced: "bg-warning/20 text-warning",
  bidding: "bg-accent/20 text-accent",
  awarded: "bg-primary/20 text-primary",
  completed: "bg-success/20 text-success",
  failed: "bg-destructive/20 text-destructive",
};

export default function TaskAllocationPanel() {
  const swarmTasks = useSwarmStore((s) => s.swarmTasks);
  const agents = useSwarmStore((s) => s.agents);

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="w-4 h-4 text-primary" />
        <h4 className="font-mono text-xs text-muted-foreground tracking-wider">TASK ALLOCATION</h4>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{swarmTasks.length} tasks</span>
      </div>
      {swarmTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No tasks allocated yet. Discover a target to create tasks.</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {swarmTasks.map((task, i) => {
            const awarded = agents.find((a) => a.id === task.awardedTo);
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-lg bg-muted/30 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground capitalize">{task.type.replace("_", " ")}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${statusColors[task.status] || ""}`}>
                    {task.status}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {task.bids.length} bid{task.bids.length !== 1 ? "s" : ""}
                  {awarded && ` • Awarded to ${awarded.name}`}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
