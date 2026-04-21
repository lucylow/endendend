import { Badge } from "@/components/ui/badge";
import type { MeshResiliencePublicView } from "@/vertex2/types";

export function Vertex2ConsensusPanel({ mesh }: { mesh: MeshResiliencePublicView | null }) {
  if (!mesh) return null;
  const h = mesh.consensus.health;
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-muted-foreground">PoC sequence</span>
        <Badge variant="outline">{h.sequence}</Badge>
        <span className="text-muted-foreground">quorum stress</span>
        <Badge variant={(h.stress01 ?? 0) > 0.45 ? "destructive" : "secondary"}>{(h.stress01 * 100).toFixed(0)}%</Badge>
      </div>
      <div className="text-[10px] text-muted-foreground font-mono truncate">last {h.lastCommitHash?.slice(0, 18) ?? "—"}</div>
      <div className="space-y-1">
        {mesh.consensus.proposals.slice(-6).map((p) => (
          <div key={p.id} className="border border-border/40 rounded-md p-2">
            <div className="flex justify-between gap-2">
              <span className="font-mono text-[10px]">{p.id}</span>
              <Badge variant={p.status === "committed" ? "default" : p.status === "rejected" ? "destructive" : "outline"}>
                {p.status}
              </Badge>
            </div>
            <p className="text-muted-foreground text-[10px] mt-1">{p.summary}</p>
            <div className="text-[10px] text-muted-foreground mt-1">
              yes {p.votesYes} · no {p.votesNo} · pend {p.votesPending} · need {p.quorumNeed}
              {p.commitLatencyMs != null ? ` · latency ${p.commitLatencyMs}ms` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
