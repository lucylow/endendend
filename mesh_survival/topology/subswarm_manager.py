"""Partitioned operation: elect local coordinator; scoped topics until merge."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Mapping, Optional


@dataclass
class SubswarmManager:
    partition_id: str
    coordinator: Optional[str] = None
    members: List[str] = field(default_factory=list)

    def update_members(self, nodes: List[str]) -> None:
        self.members = sorted(set(nodes))

    def elect_coordinator(self, depth_by_node: Mapping[str, int]) -> Optional[str]:
        """Deeper nodes preferred (closer to explorer tip); lexicographic tie-break."""
        candidates = [n for n in self.members if n in depth_by_node]
        if not candidates:
            self.coordinator = None
            return None
        self.coordinator = max(candidates, key=lambda n: (int(depth_by_node.get(n, 0)), n))
        return self.coordinator

    def local_mesh_topic(self, swarm_id: str, suffix: str) -> str:
        return f"swarm/{swarm_id}/mesh/partition/{self.partition_id}/{suffix}"
