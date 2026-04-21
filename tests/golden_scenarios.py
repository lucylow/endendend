"""
Golden coordination narratives: expected state sequences for hackathon judging.

These are lightweight documentation tests; extend with JSON snapshots if needed.
"""

from __future__ import annotations

from swarm.chain_manager import DroneRole
from swarm.coordination.state_machine import (
    BlackoutCoordinationConfig,
    BlackoutStateMachine,
    HeartbeatMsg,
    SwarmState,
)


def test_golden_five_drone_mesh_boots_into_exploring() -> None:
    """# JUDGE TEST: Five concurrent standbys satisfy forming quorum then explore."""
    cfg = BlackoutCoordinationConfig(min_peers_forming=5, min_live_recovering=3)
    sm = BlackoutStateMachine(config=cfg)
    t0 = 50.0
    for i in range(5):
        sm.on_heartbeat(
            HeartbeatMsg(
                node_id=f"drone_{i}",
                ts=t0,
                depth=float(i),
                trust=0.5 + i * 0.01,
                role=DroneRole.STANDBY,
            ),
            now=t0,
        )
    assert sm.swarm_state == SwarmState.EXPLORING
    assert sm.explorer_id is not None
