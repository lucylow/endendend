import { ScrollArea } from "@/components/ui/scroll-area";
import type { MeshSurvivalPublicView } from "@/mesh/types";

export function MeshEventFeed({ mesh }: { mesh: MeshSurvivalPublicView | null }) {
  const tail = mesh?.ledgerTail ?? [];
  return (
    <ScrollArea className="h-[160px] font-mono text-[10px]">
      {tail.slice(-36).map((e) => (
        <div key={e.id} className="border-b border-border/15 py-1 text-muted-foreground">
          <span className="text-foreground/90">{e.kind}</span> · {e.summary}
        </div>
      ))}
    </ScrollArea>
  );
}
