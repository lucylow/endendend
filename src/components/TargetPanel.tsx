import { motion } from "framer-motion";
import { useSwarmStore } from "@/store/swarmStore";
import { Button } from "@/components/ui/button";
import { Crosshair, AlertTriangle } from "lucide-react";

export default function TargetPanel() {
  const targets = useSwarmStore((s) => s.targets);
  const agents = useSwarmStore((s) => s.agents);
  const triggerTargetDiscovery = useSwarmStore((s) => s.triggerTargetDiscovery);

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-mono text-xs text-muted-foreground tracking-wider">TARGET DISCOVERY</h4>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={triggerTargetDiscovery}>
          <Crosshair className="w-3 h-3" /> Simulate Find
        </Button>
      </div>
      {targets.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No targets discovered yet. Start the simulation and trigger a discovery.</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {targets.map((t, i) => {
            const assigned = agents.find((a) => a.id === t.assignedAgent);
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2"
              >
                <AlertTriangle className={`w-4 h-4 shrink-0 ${t.status === "rescued" ? "text-success" : "text-warning"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">
                    Victim @ ({t.location.x.toFixed(1)}, {t.location.z.toFixed(1)})
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Confidence: {(t.confidence * 100).toFixed(0)}% • {t.status}
                    {assigned && ` • Assigned: ${assigned.name}`}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
