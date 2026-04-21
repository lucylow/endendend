import { ScrollArea } from "@/components/ui/scroll-area";
import type { MeshResiliencePublicView } from "@/vertex2/types";

export function Vertex2RecoveryPanel({ mesh }: { mesh: MeshResiliencePublicView | null }) {
  if (!mesh) return null;
  return (
    <div className="space-y-2 text-xs">
      <p className="text-muted-foreground text-[10px]">
        Checkpoints commit through Arc settlement hints; recovery replays buffered mesh votes after partition heal.
      </p>
      <ScrollArea className="h-[120px] font-mono text-[10px]">
        {mesh.checkpoints.length === 0 ? (
          <span className="text-muted-foreground">No checkpoints yet</span>
        ) : (
          mesh.checkpoints.map((c) => (
            <div key={c} className="border-b border-border/20 py-1">
              {c}
            </div>
          ))
        )}
      </ScrollArea>
      <div className="text-[10px] text-muted-foreground">
        role handoffs: {mesh.roleHistory.length} · mesh tasks: {mesh.taskHistory.length}
      </div>
      {mesh.taskHistory.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-foreground">Recent mesh task scores</p>
          <ScrollArea className="h-[100px] text-[10px] font-mono">
            {mesh.taskHistory
              .slice(-5)
              .reverse()
              .map((t) => (
                <div key={`${t.taskId}-${t.atMs}`} className="border-b border-border/20 py-1">
                  <span className="text-foreground">{t.winnerId}</span> · {t.taskId} · score {t.score.toFixed(2)}
                  <div className="text-muted-foreground">{t.reasons.join(" · ")}</div>
                </div>
              ))}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
