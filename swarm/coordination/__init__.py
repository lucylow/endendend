"""Modular swarm coordination: heartbeats, Vertex/FoxMQ-style broadcast, PBFT hooks."""

from swarm.coordination.consensus_engine import ConsensusEngine, stake_amplified_scores
from swarm.coordination.heartbeat_monitor import HeartbeatMonitor
from swarm.coordination.swarm_coordinator import SwarmCoordinator

__all__ = [
    "ConsensusEngine",
    "HeartbeatMonitor",
    "SwarmCoordinator",
    "stake_amplified_scores",
]
