import { ScrollArea } from "@/components/ui/scroll-area";
import type { MapLedgerEvent } from "@/foxmq/mapLedger";

const INTERESTING = new Set<MapLedgerEvent["eventType"]>([
  "map_delta",
  "recovery_merge",
  "offline_buffer",
  "snapshot_commit",
  "replay_tick",
  "node_disconnect",
  "node_reconnect",
]);

type Props = { events: MapLedgerEvent[] };

export function MapDeltaFeed({ events }: Props) {
  const rows = events.filter((e) => INTERESTING.has(e.eventType)).slice(-40).reverse();
  return (
    <ScrollArea className="h-[160px] text-[10px] font-mono">
      {rows.map((e) => (
        <div key={e.eventId} className="border-b border-border/20 py-1 text-muted-foreground">
          <span className="text-foreground">{e.eventType}</span> · {e.nodeId} · {e.affectedCells.length} cells
          {e.payload?.checksum ? <span className="ml-1">chk {String(e.payload.checksum).slice(0, 8)}</span> : null}
        </div>
      ))}
    </ScrollArea>
  );
}
