"""Improved FoxMQ integration with discovery heartbeats and shared state management."""

from __future__ import annotations
import json
import time
import logging
import threading
import random
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple
from swarm.foxmq_integration import FoxMQClient, MeshEnvelope, MessageKind, FoxMQTopic, current_time_ms

LOG = logging.getLogger(__name__)

class SharedStateKey(str, Enum):
    WORLD_MAP = "world_map"
    MISSION_LEDGER = "mission_ledger"
    FLEET_ROSTER = "fleet_roster"

@dataclass
class PeerDiscoveryInfo:
    node_id: str
    capabilities: List[str]
    last_heartbeat: float
    status: str = "online"
    metadata: Dict[str, Any] = field(default_factory=dict)

class DiscoveryManager:
    """Manages peer discovery via heartbeats and gossip."""
    def __init__(self, client: FoxMQClient, heartbeat_interval: float = 2.0, timeout: float = 10.0):
        self.client = client
        self.heartbeat_interval = heartbeat_interval
        self.timeout = timeout
        self.peers: Dict[str, PeerDiscoveryInfo] = {}
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self):
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        LOG.info("DiscoveryManager started")

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join()

    def _run(self):
        while not self._stop_event.is_set():
            self._send_heartbeat()
            self._prune_peers()
            time.sleep(self.heartbeat_interval)

    def _send_heartbeat(self):
        payload = {
            "node_id": self.client.config.node_id,
            "ts": time.time(),
            "capabilities": ["drone", "sensor", "mesh"],
            "status": "active"
        }
        self.client.publish(MessageKind.HEARTBEAT, FoxMQTopic.HEARTBEAT, payload)

    def handle_heartbeat(self, envelope: MeshEnvelope):
        node_id = envelope.sender_id
        payload = envelope.payload
        with self._lock:
            self.peers[node_id] = PeerDiscoveryInfo(
                node_id=node_id,
                capabilities=payload.get("capabilities", []),
                last_heartbeat=time.time(),
                status=payload.get("status", "online"),
                metadata=payload
            )

    def _prune_peers(self):
        now = time.time()
        with self._lock:
            for node_id, info in list(self.peers.items()):
                if now - info.last_heartbeat > self.timeout:
                    LOG.info(f"Peer {node_id} timed out")
                    del self.peers[node_id]

    def get_active_peers(self) -> List[str]:
        with self._lock:
            return list(self.peers.keys())

class SharedStateManager:
    """Manages replicated shared state across the swarm using LWW (Last-Write-Wins)."""
    def __init__(self, client: FoxMQClient):
        self.client = client
        self.state: Dict[str, Any] = {}
        self.versions: Dict[str, int] = {}
        self._lock = threading.Lock()

    def update(self, key: str, value: Any):
        with self._lock:
            version = self.versions.get(key, 0) + 1
            self.state[key] = value
            self.versions[key] = version
            
            payload = {
                "key": key,
                "value": value,
                "version": version,
                "sender": self.client.config.node_id
            }
            self.client.publish(MessageKind.STATE, FoxMQTopic.STATE, payload)

    def handle_state_update(self, envelope: MeshEnvelope):
        payload = envelope.payload
        key = payload.get("key")
        value = payload.get("value")
        version = payload.get("version", 0)
        
        if not key: return

        with self._lock:
            current_version = self.versions.get(key, -1)
            if version > current_version:
                self.state[key] = value
                self.versions[key] = version
                LOG.debug(f"Updated shared state: {key} to version {version}")

    def get(self, key: str) -> Any:
        with self._lock:
            return self.state.get(key)

class EnhancedFoxMQIntegration:
    """Ties everything together for a robust FoxMQ experience."""
    def __init__(self, client: FoxMQClient):
        self.client = client
        self.discovery = DiscoveryManager(client)
        self.shared_state = SharedStateManager(client)
        
        # Register handlers
        self.client.on(FoxMQTopic.HEARTBEAT, self.discovery.handle_heartbeat)
        self.client.on(FoxMQTopic.STATE, self.shared_state.handle_state_update)

    def start(self):
        self.discovery.start()
        LOG.info("Enhanced FoxMQ Integration active")

    def stop(self):
        self.discovery.stop()
