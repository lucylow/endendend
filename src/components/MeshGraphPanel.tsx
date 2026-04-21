import type { MeshSurvivalPublicView } from "@/mesh/types";

export function MeshGraphPanel({ mesh }: { mesh: MeshSurvivalPublicView | null }) {
  const g = mesh?.graph;
  if (!g) return <p className="text-xs text-muted-foreground">No graph yet.</p>;
  return (
    <ul className="text-[11px] space-y-1 text-muted-foreground">
      <li>
        <span className="text-foreground font-medium">Nodes</span> {g.nodes.length} · edges {g.edges.length}
      </li>
      <li>
        <span className="text-foreground font-medium">Bridges</span> {g.bridgeNodes.join(", ") || "—"}
      </li>
      <li>
        <span className="text-foreground font-medium">Isolated</span> {g.isolatedNodes.length ? g.isolatedNodes.join(", ") : "none"}
      </li>
      <li>
        <span className="text-foreground font-medium">Bottleneck</span>{" "}
        {g.bottleneckEdge ? `${g.bottleneckEdge.a}↔${g.bottleneckEdge.b} (q ${(g.bottleneckEdge.quality01 * 100).toFixed(0)}%)` : "—"}
      </li>
      <li>
        <span className="text-foreground font-medium">Operator reach</span> {g.operatorReachable.length}
      </li>
    </ul>
  );
}
