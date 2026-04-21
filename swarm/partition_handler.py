"""Network partition handling with heartbeat timeout detection and split-brain prevention.

Implements:
- Heartbeat timeout detection
- Split-brain prevention via ROLE_ANNOUNCE conflict resolution
- Graceful degradation on node dropout
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set

LOG = logging.getLogger(__name__)


class PartitionState(Enum):
    """Network partition detection states."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    PARTITIONED = "partitioned"
    RECOVERING = "recovering"


@dataclass(slots=True)
class HeartbeatRecord:
    """Record of heartbeat from a peer."""
    node_id: str
    last_seen_ms: int
    sequence_num: int = 0
    is_alive: bool = True
    consecutive_misses: int = 0


class PartitionHandler:
    """Detects and handles network partitions with split-brain prevention."""

    def __init__(
        self,
        node_id: str,
        *,
        heartbeat_timeout_ms: int = 5000,
        stale_timeout_ms: int = 10000,
        dead_timeout_ms: int = 30000,
        on_partition_detected: Optional[Callable[[str], None]] = None,
        on_partition_recovered: Optional[Callable[[], None]] = None,
        on_peer_timeout: Optional[Callable[[str], None]] = None,
    ) -> None:
        self.node_id = node_id
        self.heartbeat_timeout_ms = heartbeat_timeout_ms
        self.stale_timeout_ms = stale_timeout_ms
        self.dead_timeout_ms = dead_timeout_ms
        self.on_partition_detected = on_partition_detected
        self.on_partition_recovered = on_partition_recovered
        self.on_peer_timeout = on_peer_timeout

        self._heartbeats: Dict[str, HeartbeatRecord] = {}
        self._partition_state = PartitionState.HEALTHY
        self._last_partition_change_ms = 0
        self._role_announcements: Dict[str, Dict[str, Any]] = {}  # peer_id -> latest announcement
        self._alive_peer_count = 0
        self._expected_peer_count = 0

    def set_expected_peers(self, peer_ids: List[str]) -> None:
        """Set the expected set of peers in the swarm."""
        self._expected_peer_count = len(peer_ids)
        for pid in peer_ids:
            if pid not in self._heartbeats:
                self._heartbeats[pid] = HeartbeatRecord(
                    node_id=pid,
                    last_seen_ms=int(time.time() * 1000),
                    is_alive=False,
                )

    def record_heartbeat(self, peer_id: str, sequence_num: int = 0) -> None:
        """Record a heartbeat from a peer."""
        now_ms = int(time.time() * 1000)
        if peer_id not in self._heartbeats:
            self._heartbeats[peer_id] = HeartbeatRecord(
                node_id=peer_id,
                last_seen_ms=now_ms,
                sequence_num=sequence_num,
                is_alive=True,
                consecutive_misses=0,
            )
        else:
            record = self._heartbeats[peer_id]
            record.last_seen_ms = now_ms
            record.sequence_num = sequence_num
            if not record.is_alive:
                record.is_alive = True
                record.consecutive_misses = 0
                LOG.info(f"[{self.node_id}] Peer {peer_id} recovered")

    def record_role_announce(self, peer_id: str, announcement: Dict[str, Any]) -> None:
        """Record a role announcement from a peer for split-brain prevention."""
        self._role_announcements[peer_id] = announcement
        self.record_heartbeat(peer_id, announcement.get("sequence_num", 0))

    def tick(self, now_ms: Optional[int] = None) -> Dict[str, Any]:
        """
        Check heartbeat timeouts and update partition state.
        Returns status dict with partition info.
        """
        if now_ms is None:
            now_ms = int(time.time() * 1000)

        alive_count = 0
        stale_peers = []
        dead_peers = []

        for peer_id, record in self._heartbeats.items():
            elapsed_ms = now_ms - record.last_seen_ms

            if elapsed_ms < self.heartbeat_timeout_ms:
                # Peer is healthy
                if not record.is_alive:
                    record.is_alive = True
                    record.consecutive_misses = 0
                    LOG.info(f"[{self.node_id}] Peer {peer_id} became alive")
                alive_count += 1

            elif elapsed_ms < self.stale_timeout_ms:
                # Peer is stale but not dead
                if record.is_alive:
                    record.is_alive = False
                    record.consecutive_misses += 1
                    stale_peers.append(peer_id)
                    LOG.warning(f"[{self.node_id}] Peer {peer_id} is stale")

            else:
                # Peer is dead
                if record.is_alive or record.consecutive_misses < 3:
                    record.is_alive = False
                    record.consecutive_misses += 1
                    dead_peers.append(peer_id)
                    LOG.error(f"[{self.node_id}] Peer {peer_id} is dead (elapsed={elapsed_ms}ms)")
                    if self.on_peer_timeout:
                        self.on_peer_timeout(peer_id)

        self._alive_peer_count = alive_count

        # Detect partition
        old_state = self._partition_state
        self._partition_state = self._detect_partition_state(alive_count)

        if old_state != self._partition_state:
            self._last_partition_change_ms = now_ms
            LOG.warning(f"[{self.node_id}] Partition state change: {old_state.value} -> {self._partition_state.value}")
            if self._partition_state == PartitionState.PARTITIONED and self.on_partition_detected:
                self.on_partition_detected(f"Alive peers: {alive_count}/{self._expected_peer_count}")
            elif old_state == PartitionState.PARTITIONED and self.on_partition_recovered:
                self.on_partition_recovered()

        return {
            "node_id": self.node_id,
            "partition_state": self._partition_state.value,
            "alive_peers": alive_count,
            "expected_peers": self._expected_peer_count,
            "stale_peers": stale_peers,
            "dead_peers": dead_peers,
            "timestamp_ms": now_ms,
        }

    def _detect_partition_state(self, alive_count: int) -> PartitionState:
        """Determine partition state based on alive peer count."""
        if self._expected_peer_count == 0:
            return PartitionState.HEALTHY

        alive_ratio = alive_count / self._expected_peer_count
        now_ms = int(time.time() * 1000)
        time_since_change_ms = now_ms - self._last_partition_change_ms

        if alive_ratio >= 0.8:  # 80% or more alive
            return PartitionState.HEALTHY

        elif alive_ratio >= 0.5:  # 50-80% alive
            if self._partition_state == PartitionState.PARTITIONED and time_since_change_ms < 5000:
                return PartitionState.RECOVERING
            return PartitionState.DEGRADED

        else:  # Less than 50% alive
            return PartitionState.PARTITIONED

    def resolve_split_brain(
        self,
        peer_id: str,
        peer_role: str,
        peer_depth: float,
        local_role: str,
        local_depth: float,
    ) -> bool:
        """
        Resolve split-brain conflict via ROLE_ANNOUNCE.
        Returns True if local node should keep its role, False if it should defer to peer.
        """
        # Priority: depth > role > lexicographic ID
        if peer_depth != local_depth:
            return local_depth > peer_depth  # Higher depth = higher priority

        # Role priority: explorer > relay > standby
        role_priority = {"explorer": 3, "relay": 2, "standby": 1}
        peer_priority = role_priority.get(peer_role, 0)
        local_priority = role_priority.get(local_role, 0)

        if peer_priority != local_priority:
            return local_priority > peer_priority

        # Lexicographic tie-break
        return self.node_id < peer_id

    def get_partition_status(self) -> Dict[str, Any]:
        """Get current partition status."""
        return {
            "node_id": self.node_id,
            "partition_state": self._partition_state.value,
            "alive_peers": self._alive_peer_count,
            "expected_peers": self._expected_peer_count,
            "connectivity_ratio": self._alive_peer_count / max(1, self._expected_peer_count),
            "peer_records": {
                pid: {
                    "is_alive": record.is_alive,
                    "last_seen_ms": record.last_seen_ms,
                    "consecutive_misses": record.consecutive_misses,
                }
                for pid, record in self._heartbeats.items()
            },
        }

    def is_partitioned(self) -> bool:
        """Check if network is partitioned."""
        return self._partition_state == PartitionState.PARTITIONED

    def is_degraded(self) -> bool:
        """Check if network is degraded."""
        return self._partition_state in {PartitionState.DEGRADED, PartitionState.PARTITIONED}

    def is_healthy(self) -> bool:
        """Check if network is healthy."""
        return self._partition_state == PartitionState.HEALTHY

    def get_alive_peers(self) -> List[str]:
        """Get list of alive peers."""
        return [
            pid for pid, record in self._heartbeats.items()
            if record.is_alive
        ]

    def clear_peer(self, peer_id: str) -> None:
        """Remove a peer from tracking (e.g., after graceful shutdown)."""
        if peer_id in self._heartbeats:
            del self._heartbeats[peer_id]
            LOG.info(f"[{self.node_id}] Cleared peer {peer_id}")
        if peer_id in self._role_announcements:
            del self._role_announcements[peer_id]
