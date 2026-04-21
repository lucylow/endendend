"""
# SwarmModule: RelayController

## Responsibility
- Hold daisy-chain positions while the explorer extends range.
"""

from __future__ import annotations

from typing import List

from swarm.coordination.state_machine import BlackoutStateMachine, SwarmState


class RelayController:
    """# RESPONSIBILITY: Maintain chain backhaul (stubbed as no-op motion list)."""

    def __init__(self, node_id: str) -> None:
        self.node_id = node_id

    def tick(self, state_machine: BlackoutStateMachine) -> List[str]:
        if state_machine.swarm_state != SwarmState.EXPLORING:
            # WHY: Relays must not anchor until global mode stabilizes.
            return []
        return [f"{self.node_id}:hold"]
