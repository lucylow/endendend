"""Relay-chain coordination: route exploration gossip alongside other message types.

Example Scenario 1 (Dynamic Daisy Chain): standby → relay → explorer roles, chain
ordering, and repair logic are specified in the SAR demo script
(``src/lib/scenarios/dynamicDaisyChainDemoScript.ts``) and Python constants
``swarm/scenario_dynamic_daisy_chain.py``. Wire optional heartbeats / ROLE_* /
BYPASS messages through :meth:`set_message_handler` and extend
:meth:`handle_message` as policies harden.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Callable, Dict, Optional


class DroneRole(Enum):
    EXPLORER = "explorer"
    RELAY = "relay"
    STANDBY = "standby"


class ChainManager:
    def __init__(self, node_id: str) -> None:
        self.node_id = node_id
        self.role: DroneRole = DroneRole.STANDBY
        self.exploration_manager: Optional[Any] = None
        self._fallback: Optional[Callable[[str, Dict[str, Any]], None]] = None

    def set_exploration_manager(self, exploration_manager: Any) -> None:
        self.exploration_manager = exploration_manager

    def set_message_handler(self, handler: Callable[[str, Dict[str, Any]], None]) -> None:
        """Optional hook for non-exploration messages (chain repair, heartbeats, etc.)."""
        self._fallback = handler

    def handle_message(self, sender: str, msg: Dict[str, Any]) -> None:
        msg_type = msg.get("type")
        if msg_type == "EXPLORATION_UPDATE" and self.exploration_manager is not None:
            self.exploration_manager.handle_exploration_update(sender, msg)
            return
        if self._fallback is not None:
            self._fallback(sender, msg)
