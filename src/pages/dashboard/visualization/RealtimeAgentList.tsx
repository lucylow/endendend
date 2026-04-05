import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSwarmStore } from "@/store/swarmStore";

/**
 * Compact live table of agent telemetry (positions and fields are driven by the WebSocket hook on the viz page).
 */
export function RealtimeAgentList() {
  const agents = useSwarmStore((s) => s.agents);
  const now = Date.now();
  const rows = [...agents].sort((a, b) => a.id.localeCompare(b.id)).slice(0, 12);

  return (
    <div className="pointer-events-auto max-h-80 overflow-auto rounded-xl border border-zinc-800/90 bg-zinc-950/90 shadow-xl backdrop-blur-xl">
      <p className="border-b border-zinc-800/80 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        Live agents
      </p>
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="h-9 text-zinc-400">ID</TableHead>
            <TableHead className="text-zinc-400">Role</TableHead>
            <TableHead className="text-zinc-400">Battery</TableHead>
            <TableHead className="text-zinc-400">Status</TableHead>
            <TableHead className="text-right text-zinc-400">Δ telemetry</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((agent) => {
            const skew =
              agent.lastTelemetryServerMs != null
                ? Math.max(0, now - agent.lastTelemetryServerMs)
                : null;
            return (
              <TableRow key={agent.id} className="border-zinc-800/80">
                <TableCell className="py-2 font-mono text-xs text-zinc-200">
                  {agent.id.length > 8 ? `…${agent.id.slice(-6)}` : agent.id}
                </TableCell>
                <TableCell className="py-2">
                  <Badge variant={agent.role === "explorer" ? "default" : "secondary"} className="text-[10px]">
                    {agent.role}
                  </Badge>
                </TableCell>
                <TableCell className="py-2 font-mono text-xs text-zinc-300">{agent.battery.toFixed(0)}%</TableCell>
                <TableCell className="py-2 text-xs capitalize text-zinc-400">{agent.status}</TableCell>
                <TableCell className="py-2 text-right font-mono text-[10px] text-zinc-500">
                  {skew != null ? `${skew.toFixed(0)}ms` : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
