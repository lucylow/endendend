"""Per-drone P2P server using Flask and SocketIO.

Each drone exposes its own WebSocket endpoint on a unique port (9001-9005).
Implements P2P state sharing via HEARTBEAT, ROLE_ANNOUNCE, ELECTION_WIN, KILL messages.
No central broker; all coordination is peer-to-peer.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from dataclasses import asdict, dataclass
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set

try:
    from flask import Flask, request
    from flask_socketio import SocketIO, emit, join_room, leave_room
except ImportError:
    Flask = None  # type: ignore
    SocketIO = None  # type: ignore
    emit = None  # type: ignore
    join_room = None  # type: ignore
    leave_room = None  # type: ignore

LOG = logging.getLogger(__name__)


class MessageKind(Enum):
    """P2P message types for swarm coordination."""
    HEARTBEAT = "HEARTBEAT"
    ROLE_ANNOUNCE = "ROLE_ANNOUNCE"
    ELECTION_WIN = "ELECTION_WIN"
    KILL = "KILL"
    EXPLORATION_UPDATE = "EXPLORATION_UPDATE"
    RELAY_CHAIN_UPDATE = "RELAY_CHAIN_UPDATE"
    STATE_SYNC = "STATE_SYNC"


@dataclass(slots=True)
class P2PMessage:
    """Standardized P2P message envelope."""
    sender_id: str
    message_kind: str
    timestamp_ms: int
    payload: Dict[str, Any]
    sequence_num: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> P2PMessage:
        return cls(
            sender_id=data.get("sender_id", ""),
            message_kind=data.get("message_kind", ""),
            timestamp_ms=data.get("timestamp_ms", 0),
            payload=data.get("payload", {}),
            sequence_num=data.get("sequence_num", 0),
        )


class P2PServer:
    """Per-drone P2P server managing WebSocket connections and message routing."""

    def __init__(
        self,
        node_id: str,
        host: str = "127.0.0.1",
        port: int = 9001,
        *,
        on_message: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> None:
        self.node_id = node_id
        self.host = host
        self.port = port
        self.on_message = on_message
        self.app: Optional[Any] = None
        self.socketio: Optional[Any] = None
        self._connected_peers: Set[str] = set()
        self._peer_endpoints: Dict[str, str] = {}  # peer_id -> "host:port"
        self._sequence_num = 0
        self._lock = threading.RLock()
        self._server_thread: Optional[threading.Thread] = None
        self._running = False

    def initialize(self) -> None:
        """Initialize Flask app and SocketIO."""
        if Flask is None or SocketIO is None:
            LOG.warning("Flask or SocketIO not available; P2P server disabled")
            return

        self.app = Flask(f"drone_{self.node_id}")
        self.socketio = SocketIO(self.app, cors_allowed_origins="*", async_mode="threading")

        @self.app.route("/health")
        def health():
            return {"status": "ok", "node_id": self.node_id}, 200

        @self.socketio.on("connect")
        def on_connect():
            peer_id = request.sid
            LOG.info(f"[{self.node_id}] Peer connected: {peer_id}")
            with self._lock:
                self._connected_peers.add(peer_id)
            emit("welcome", {"node_id": self.node_id})

        @self.socketio.on("disconnect")
        def on_disconnect():
            peer_id = request.sid
            LOG.info(f"[{self.node_id}] Peer disconnected: {peer_id}")
            with self._lock:
                self._connected_peers.discard(peer_id)

        @self.socketio.on("message")
        def on_message_received(data: Dict[str, Any]):
            try:
                msg = P2PMessage.from_dict(data)
                LOG.debug(f"[{self.node_id}] Received from {msg.sender_id}: {msg.message_kind}")
                if self.on_message:
                    self.on_message(msg.sender_id, msg.to_dict())
            except Exception as e:
                LOG.error(f"[{self.node_id}] Error processing message: {e}")

    def start(self) -> None:
        """Start the P2P server in a background thread."""
        if self.app is None or self.socketio is None:
            LOG.warning(f"[{self.node_id}] Cannot start P2P server: not initialized")
            return

        if self._running:
            LOG.warning(f"[{self.node_id}] P2P server already running")
            return

        self._running = True
        self._server_thread = threading.Thread(
            target=self._run_server,
            daemon=True,
            name=f"p2p_server_{self.node_id}",
        )
        self._server_thread.start()
        LOG.info(f"[{self.node_id}] P2P server started on {self.host}:{self.port}")

    def _run_server(self) -> None:
        """Run the Flask/SocketIO server (blocking)."""
        try:
            if self.socketio is not None:
                self.socketio.run(
                    self.app,
                    host=self.host,
                    port=self.port,
                    debug=False,
                    use_reloader=False,
                    log_output=False,
                )
        except Exception as e:
            LOG.error(f"[{self.node_id}] P2P server error: {e}")
        finally:
            self._running = False

    def stop(self) -> None:
        """Stop the P2P server."""
        self._running = False
        if self._server_thread is not None:
            self._server_thread.join(timeout=2.0)
        LOG.info(f"[{self.node_id}] P2P server stopped")

    def register_peer(self, peer_id: str, endpoint: str) -> None:
        """Register a peer endpoint (host:port)."""
        with self._lock:
            self._peer_endpoints[peer_id] = endpoint
        LOG.debug(f"[{self.node_id}] Registered peer {peer_id} at {endpoint}")

    def broadcast_message(
        self,
        message_kind: str,
        payload: Dict[str, Any],
        *,
        exclude_self: bool = True,
    ) -> None:
        """Broadcast a message to all connected peers."""
        with self._lock:
            self._sequence_num += 1
            seq = self._sequence_num

        msg = P2PMessage(
            sender_id=self.node_id,
            message_kind=message_kind,
            timestamp_ms=int(time.time() * 1000),
            payload=payload,
            sequence_num=seq,
        )

        if self.socketio is not None:
            try:
                self.socketio.emit("message", msg.to_dict(), broadcast=True, skip_sid=True)
                LOG.debug(f"[{self.node_id}] Broadcast {message_kind} (seq={seq})")
            except Exception as e:
                LOG.error(f"[{self.node_id}] Broadcast error: {e}")

    def send_to_peer(
        self,
        peer_id: str,
        message_kind: str,
        payload: Dict[str, Any],
    ) -> None:
        """Send a message to a specific peer."""
        with self._lock:
            self._sequence_num += 1
            seq = self._sequence_num

        msg = P2PMessage(
            sender_id=self.node_id,
            message_kind=message_kind,
            timestamp_ms=int(time.time() * 1000),
            payload=payload,
            sequence_num=seq,
        )

        if self.socketio is not None:
            try:
                self.socketio.emit("message", msg.to_dict(), to=peer_id)
                LOG.debug(f"[{self.node_id}] Sent {message_kind} to {peer_id}")
            except Exception as e:
                LOG.error(f"[{self.node_id}] Send to peer error: {e}")

    def get_connected_peers(self) -> List[str]:
        """Get list of connected peer IDs."""
        with self._lock:
            return list(self._connected_peers)

    def get_peer_endpoint(self, peer_id: str) -> Optional[str]:
        """Get the endpoint for a peer."""
        with self._lock:
            return self._peer_endpoints.get(peer_id)

    def is_running(self) -> bool:
        """Check if the server is running."""
        return self._running
