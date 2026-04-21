import { ScrollArea } from "@/components/ui/scroll-area";
import type { ReplayNarrativeEntry } from "@/vertex2/types";

export function Vertex2ReplayPanel({ entries }: { entries: ReplayNarrativeEntry[] }) {
  return (
    <ScrollArea className="h-[220px] text-[10px]">
      <div className="space-y-2 pr-3">
        {entries.length === 0 && <p className="text-muted-foreground">Replay narrative builds as the mesh ledger grows.</p>}
        {entries.map((e, i) => (
          <div key={`${e.atMs}-${i}`} className="border-b border-border/25 pb-2">
            <div className="flex justify-between gap-2">
              <span className="font-medium text-foreground">{e.label}</span>
              <span className="text-muted-foreground font-mono">{e.atMs}</span>
            </div>
            <p className="text-muted-foreground mt-0.5">{e.detail}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
