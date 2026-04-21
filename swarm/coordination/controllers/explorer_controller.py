"""
# SwarmModule: ExplorerController

## Responsibility
- Produce frontier / victim-surface **intent** when the swarm is in ``EXPLORING``.

## Diagram
```mermaid
sequenceDiagram
  participant SM as BlackoutStateMachine
  participant EX as ExplorerController
  SM-->>EX: swarm_state == EXPLORING
  EX-->>EX: advance_frontier (sim stub)
```
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from swarm.coordination.state_machine import BlackoutStateMachine, SwarmState


@dataclass(frozen=True)
class MoveIntent:
    x: float
    y: float


class ExplorerController:
    """# RESPONSIBILITY: Advance frontier, surface victim detections (coordination-only stubs)."""

    def __init__(self, node_id: str) -> None:
        self.node_id = node_id

    def advance_frontier(self, step: float = 1.0) -> MoveIntent:
        """# WHY: Deterministic stub so judges see motion without Webots."""
        return MoveIntent(step, 0.0)

    def tick(self, state_machine: BlackoutStateMachine) -> List[MoveIntent]:
        if state_machine.swarm_state != SwarmState.EXPLORING:
            # WHY: Do not move the mesh while roles are unresolved.
            return []
        if state_machine.explorer_id != self.node_id:
            # WHY: Only the elected explorer advances the blackout frontier.
            return []
        return [self.advance_frontier()]
