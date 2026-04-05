import { useSwarmStore } from "@/store/swarmStore";
import { ScrollArea } from "@/components/ui/scroll-area";

const typeIcons: Record<string, string> = {
  agent_deployed: "🚀",
  task_assigned: "📋",
  relay_inserted: "📡",
  agent_failed: "⚠️",
  mission_complete: "✅",
  target_found: "🎯",
  role_handoff: "🔄",
  rescue_handoff: "🛟",
  cell_searched: "🔍",
  consensus_start: "🗳️",
  consensus_success: "✅",
  consensus_fail: "❌",
  byzantine_detected: "🐛",
  fault_injected: "⚡",
};

export default function EventLog() {
  const eventLog = useSwarmStore((s) => s.eventLog);
  const recent = eventLog.slice(-30).reverse();

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <h4 className="font-mono text-xs text-muted-foreground tracking-wider mb-3">EVENT LOG ({eventLog.length} total)</h4>
      <ScrollArea className="h-64">
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No events yet.</p>
        ) : (
          <div className="space-y-1.5">
            {recent.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-[10px]">
                <span className="shrink-0">{typeIcons[e.type] || "•"}</span>
                <span className={`leading-relaxed ${e.type.includes("fail") || e.type.includes("byzantine") ? "text-destructive" : e.type.includes("success") ? "text-success" : "text-muted-foreground"}`}>
                  {e.description}
                </span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
