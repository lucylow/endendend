"""
# SwarmModule: StandbyController

## Responsibility
- Stay hot-swappable while heartbeats prove mesh health.
"""

from __future__ import annotations

from typing import List

from swarm.coordination.state_machine import BlackoutStateMachine


class StandbyController:
    """# RESPONSIBILITY: Local safety + promotion readiness (stub)."""

    def __init__(self, node_id: str) -> None:
        self.node_id = node_id

    def tick(self, state_machine: BlackoutStateMachine) -> List[str]:
        _ = state_machine
        return [f"{self.node_id}:standby"]
