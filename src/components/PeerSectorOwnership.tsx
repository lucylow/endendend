import type { NodeExplorationState } from "@/swarm/types";

type Props = { exploration: NodeExplorationState[] };

export function PeerSectorOwnership({ exploration }: Props) {
  if (!exploration.length) return <p className="text-[11px] text-muted-foreground">No sector assignments yet.</p>;
  return (
    <ul className="text-[10px] font-mono space-y-1 max-h-[140px] overflow-y-auto">
      {exploration.map((ex) => (
        <li key={ex.nodeId} className="text-muted-foreground">
          <span className="text-foreground">{ex.nodeId}</span> · {ex.assignment?.sectorLabel ?? "—"} · frontiers{" "}
          {ex.assignment?.frontierKeys.length ?? 0}
        </li>
      ))}
    </ul>
  );
}
