"""Enhanced ChainManager with state callbacks and relay topology management.

Extends the original ChainManager with:
- state_update_callback triggered on every topology change
- relay chain rebuilt from local peer state only
- dynamic relay insertion based on depth and connectivity
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set

LOG = logging.getLogger(__name__)


class DroneRole(Enum):
    """Drone role in the swarm."""
    EXPLORER = "explorer"
    RELAY = "relay"
    STANDBY = "standby"


@dataclass(slots=True)
class PeerState:
    """Local view of a peer's state."""
    node_id: str
    role: DroneRole = DroneRole.STANDBY
    depth: float = 0.0
    battery: float = 100.0
    last_seen_ms: int = 0
    is_alive: bool = True
    signal_strength: float = 1.0  # 0.0 to 1.0


@dataclass(slots=True)
class RelayChainLink:
    """A link in the relay chain."""
    from_node: str
    to_node: str
    depth_diff: float = 0.0
    signal_quality: float = 1.0
    timestamp_ms: int = 0


class EnhancedChainManager:
    """Enhanced chain manager with topology awareness and relay management."""

    def __init__(
        self,
        node_id: str,
        *,
        on_state_update: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_role_change: Optional[Callable[[DroneRole], None]] = None,
    ) -> None:
        self.node_id = node_id
        self.role = DroneRole.STANDBY
        self.depth = 0.0
        self.battery = 100.0
        self.on_state_update = on_state_update
        self.on_role_change = on_role_change

        # Local peer state tracking
        self._peer_states: Dict[str, PeerState] = {}
        self._relay_chain: List[RelayChainLink] = []
        self._exploration_manager: Optional[Any] = None
        self._fallback_handler: Optional[Callable[[str, Dict[str, Any]], None]] = None
        self._last_topology_update_ms = 0
        self._topology_version = 0

    def set_exploration_manager(self, exploration_manager: Any) -> None:
        """Set the exploration manager for handling exploration updates."""
        self._exploration_manager = exploration_manager

    def set_message_handler(self, handler: Callable[[str, Dict[str, Any]], None]) -> None:
        """Set fallback handler for non-exploration messages."""
        self._fallback_handler = handler

    def update_peer_state(
        self,
        peer_id: str,
        role: str,
        depth: float,
        battery: float,
        signal_strength: float = 1.0,
    ) -> None:
        """Update local view of a peer's state."""
        now_ms = int(time.time() * 1000)
        peer_state = PeerState(
            node_id=peer_id,
            role=DroneRole(role) if role in [r.value for r in DroneRole] else DroneRole.STANDBY,
            depth=depth,
            battery=battery,
            last_seen_ms=now_ms,
            is_alive=True,
            signal_strength=signal_strength,
        )
        self._peer_states[peer_id] = peer_state
        self._rebuild_relay_chain()

    def update_local_state(self, depth: float, battery: float) -> None:
        """Update local drone state."""
        old_depth = self.depth
        old_battery = self.battery
        self.depth = depth
        self.battery = battery

        # Trigger state update if significant change
        if abs(old_depth - depth) > 0.1 or abs(old_battery - battery) > 5.0:
            self._trigger_state_update()

    def set_role(self, role: DroneRole) -> None:
        """Set the role of this drone."""
        if self.role != role:
            old_role = self.role
            self.role = role
            LOG.info(f"[{self.node_id}] Role changed: {old_role.value} -> {role.value}")
            if self.on_role_change:
                self.on_role_change(role)
            self._trigger_state_update()

    def handle_message(self, sender: str, msg: Dict[str, Any]) -> None:
        """Handle incoming P2P message."""
        msg_type = msg.get("type")

        if msg_type == "EXPLORATION_UPDATE" and self._exploration_manager is not None:
            self._exploration_manager.handle_exploration_update(sender, msg)
            return

        if msg_type == "ROLE_ANNOUNCE":
            self._handle_role_announce(sender, msg)
            return

        if msg_type == "RELAY_CHAIN_UPDATE":
            self._handle_relay_chain_update(sender, msg)
            return

        if self._fallback_handler is not None:
            self._fallback_handler(sender, msg)

    def _handle_role_announce(self, sender: str, msg: Dict[str, Any]) -> None:
        """Handle role announcement from peer."""
        role_str = msg.get("role", "standby")
        depth = msg.get("depth", 0.0)
        battery = msg.get("battery", 100.0)
        signal_strength = msg.get("signal_strength", 1.0)

        self.update_peer_state(sender, role_str, depth, battery, signal_strength)
        LOG.debug(f"[{self.node_id}] Role announce from {sender}: {role_str} (depth={depth})")

    def _handle_relay_chain_update(self, sender: str, msg: Dict[str, Any]) -> None:
        """Handle relay chain update from peer."""
        chain_data = msg.get("chain", [])
        LOG.debug(f"[{self.node_id}] Relay chain update from {sender}: {len(chain_data)} links")
        # Could merge or validate chain here

    def _rebuild_relay_chain(self) -> None:
        """Rebuild relay chain from local peer state."""
        now_ms = int(time.time() * 1000)
        self._relay_chain.clear()

        # Get all alive peers sorted by depth
        alive_peers = [
            p for p in self._peer_states.values()
            if p.is_alive and (now_ms - p.last_seen_ms) < 30000  # 30s timeout
        ]
        alive_peers.sort(key=lambda p: p.depth, reverse=True)  # Deeper first

        # Build relay chain: explorer -> relay(s) -> standby
        explorer = None
        relays = []
        standbys = []

        for peer in alive_peers:
            if peer.role == DroneRole.EXPLORER:
                explorer = peer
            elif peer.role == DroneRole.RELAY:
                relays.append(peer)
            else:
                standbys.append(peer)

        # Build links: explorer -> relays -> standbys
        if explorer is not None:
            prev_node = explorer
            for relay in relays:
                link = RelayChainLink(
                    from_node=prev_node.node_id,
                    to_node=relay.node_id,
                    depth_diff=abs(prev_node.depth - relay.depth),
                    signal_quality=relay.signal_strength,
                    timestamp_ms=now_ms,
                )
                self._relay_chain.append(link)
                prev_node = relay

            # Link last relay to standby if available
            if standbys and relays:
                last_relay = relays[-1]
                for standby in standbys:
                    link = RelayChainLink(
                        from_node=last_relay.node_id,
                        to_node=standby.node_id,
                        depth_diff=abs(last_relay.depth - standby.depth),
                        signal_quality=standby.signal_strength,
                        timestamp_ms=now_ms,
                    )
                    self._relay_chain.append(link)

        self._topology_version += 1
        self._trigger_state_update()

    def _trigger_state_update(self) -> None:
        """Trigger state update callback."""
        now_ms = int(time.time() * 1000)
        if now_ms - self._last_topology_update_ms < 100:  # Debounce
            return

        self._last_topology_update_ms = now_ms

        state_snapshot = {
            "node_id": self.node_id,
            "role": self.role.value,
            "depth": self.depth,
            "battery": self.battery,
            "topology_version": self._topology_version,
            "peers": {
                pid: {
                    "role": p.role.value,
                    "depth": p.depth,
                    "battery": p.battery,
                    "is_alive": p.is_alive,
                    "signal_strength": p.signal_strength,
                }
                for pid, p in self._peer_states.items()
            },
            "relay_chain": [
                {
                    "from": link.from_node,
                    "to": link.to_node,
                    "depth_diff": link.depth_diff,
                    "signal_quality": link.signal_quality,
                }
                for link in self._relay_chain
            ],
            "timestamp_ms": now_ms,
        }

        if self.on_state_update:
            self.on_state_update(state_snapshot)

    def get_relay_chain(self) -> List[RelayChainLink]:
        """Get current relay chain."""
        return list(self._relay_chain)

    def get_peer_states(self) -> Dict[str, PeerState]:
        """Get all known peer states."""
        return dict(self._peer_states)

    def get_topology_snapshot(self) -> Dict[str, Any]:
        """Get current topology snapshot."""
        return {
            "node_id": self.node_id,
            "role": self.role.value,
            "depth": self.depth,
            "battery": self.battery,
            "topology_version": self._topology_version,
            "peer_count": len(self._peer_states),
            "relay_chain_length": len(self._relay_chain),
        }

    def mark_peer_dead(self, peer_id: str) -> None:
        """Mark a peer as dead (timeout)."""
        if peer_id in self._peer_states:
            self._peer_states[peer_id].is_alive = False
            LOG.warning(f"[{self.node_id}] Peer {peer_id} marked dead")
            self._rebuild_relay_chain()

    def mark_peer_alive(self, peer_id: str) -> None:
        """Mark a peer as alive (recovered)."""
        if peer_id in self._peer_states:
            self._peer_states[peer_id].is_alive = True
            LOG.info(f"[{self.node_id}] Peer {peer_id} recovered")
            self._rebuild_relay_chain()

    def clear_dead_peers(self, timeout_ms: int = 60000) -> None:
        """Remove peers that haven't been seen in timeout_ms."""
        now_ms = int(time.time() * 1000)
        dead_peers = [
            pid for pid, p in self._peer_states.items()
            if (now_ms - p.last_seen_ms) > timeout_ms
        ]
        for pid in dead_peers:
            del self._peer_states[pid]
            LOG.debug(f"[{self.node_id}] Removed stale peer {pid}")
        if dead_peers:
            self._rebuild_relay_chain()
