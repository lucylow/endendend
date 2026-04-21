import type { MeshSurvivalPublicView } from "@/mesh/types";

export function MeshPartitionPanel({ mesh }: { mesh: MeshSurvivalPublicView | null }) {
  const clusters = mesh?.graph.partitionClusters ?? [];
  return (
    <div className="text-[11px] space-y-2">
      <p>
        <span className="text-foreground font-medium">Clusters</span> {clusters.length}
      </p>
      <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
        {clusters.map((c, i) => (
          <li key={i}>
            {c.length} peers: <span className="font-mono">{c.slice(0, 5).join(", ")}</span>
            {c.length > 5 ? "…" : ""}
          </li>
        ))}
      </ol>
      <p>
        <span className="text-foreground font-medium">Recovery</span> {mesh?.recovery.phase ?? "—"} · pending buf{" "}
        {mesh?.recovery.pendingFlush ?? 0}
      </p>
    </div>
  );
}
