import { motion } from "framer-motion";
import { useSwarmStore } from "@/store/swarmStore";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft } from "lucide-react";

export default function RoleHandoffPanel() {
  const agents = useSwarmStore((s) => s.agents);
  const handoffs = useSwarmStore((s) => s.handoffs);
  const triggerRoleHandoff = useSwarmStore((s) => s.triggerRoleHandoff);

  const explorer = agents.find((a) => a.role === "explorer");
  const relays = agents.filter((a) => a.role === "relay");

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ArrowRightLeft className="w-4 h-4 text-primary" />
        <h4 className="font-mono text-xs text-muted-foreground tracking-wider">ROLE HAND-OFF</h4>
      </div>

      <div className="space-y-2 mb-3">
        {explorer && (
          <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
            <div>
              <span className="text-xs font-medium text-foreground">{explorer.name}</span>
              <span className="text-[10px] text-primary ml-2">Explorer</span>
              <span className="text-[10px] text-muted-foreground ml-2">🔋 {explorer.battery.toFixed(0)}%</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px]"
              onClick={() => triggerRoleHandoff(explorer.id, "low battery")}
            >
              Hand off
            </Button>
          </div>
        )}
        {relays.slice(0, 2).map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
            <div>
              <span className="text-xs font-medium text-foreground">{r.name}</span>
              <span className="text-[10px] text-secondary-foreground ml-2">Relay</span>
              <span className="text-[10px] text-muted-foreground ml-2">🔋 {r.battery.toFixed(0)}%</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px]"
              onClick={() => triggerRoleHandoff(r.id, "task reassignment")}
            >
              Hand off
            </Button>
          </div>
        ))}
      </div>

      {handoffs.length > 0 && (
        <div className="space-y-1 border-t border-border/50 pt-2">
          <span className="text-[10px] text-muted-foreground font-mono">HISTORY</span>
          {handoffs.slice(-3).map((h, i) => {
            const from = agents.find((a) => a.id === h.fromAgent)?.name || h.fromAgent;
            const to = agents.find((a) => a.id === h.toAgent)?.name || h.toAgent;
            return (
              <motion.div
                key={h.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[10px] text-muted-foreground"
              >
                {from} → {to} ({h.role}, {h.reason})
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
