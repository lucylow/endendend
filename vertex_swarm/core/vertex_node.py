"""High-level Vertex swarm node: P2P mesh + FoxMQ + replicated state + signed events."""

from __future__ import annotations

import logging
import os
import time
import uuid
from typing import Any, Dict, Optional, Set, Tuple, TYPE_CHECKING

from vertex_swarm.core.bft_consensus import LeaderlessVoteCollector
from vertex_swarm.core.foxmq_broker import FoxMQCluster
from vertex_swarm.core.signing import SwarmSigner
from vertex_swarm.messaging.vertex_channels import Channel, state_topic
from vertex_swarm.state.replicated_state import ReplicatedState

if TYPE_CHECKING:
    from swarm.network_emulator import NetworkEmulator
    from swarm.network_simulator import NetworkSimulator

logger = logging.getLogger(__name__)


class VertexLib:
    """Placeholder for Vertex 2.0 native core (Rust FFI / shared library).

    Set ``VERTEX_NATIVE_LIB`` to a path of a ``cdll``-loadable module to opt in;
    until then all mesh traffic uses pure-Python :class:`swarm.vertex_node.VertexNode`.
    """

    def __init__(self, node_id: str) -> None:
        self.node_id = node_id
        self._lib_path = os.environ.get("VERTEX_NATIVE_LIB", "")

    def load_native(self) -> bool:
        if not self._lib_path:
            return False
        try:
            import ctypes  # noqa: PLC0415

            ctypes.CDLL(self._lib_path)
            logger.info("Loaded native Vertex stub from %s", self._lib_path)
            return True
        except OSError as exc:
            logger.warning("VERTEX_NATIVE_LIB not loadable: %s", exc)
            return False


class VertexSwarmNode:
    """Composition root: Vertex mesh + FoxMQ client + CRDT state (zero ROS master)."""

    MSG_STATE = "VERTEX_SWARM_STATE"

    def __init__(
        self,
        node_id: str,
        *,
        swarm_id: str = "track2",
        emulator: Optional["NetworkEmulator"] = None,
        network_sim: Optional["NetworkSimulator"] = None,
        mesh_routing: bool = False,
        shared_secret: Optional[bytes] = None,
    ) -> None:
        from swarm.vertex_node import VertexNode

        self.node_id = node_id
        self.swarm_id = swarm_id
        self.vertex_lib = VertexLib(node_id)
        self._mesh_routing = bool(mesh_routing and emulator is not None and network_sim is not None)
        self.vertex = VertexNode(
            node_id,
            emulator,
            mesh_routing=self._mesh_routing,
            network_sim=network_sim if self._mesh_routing else None,
        )
        self.foxmq_cluster = FoxMQCluster(swarm_id)
        self.foxmq = self.foxmq_cluster.client_for(node_id)
        self.state = ReplicatedState()
        if shared_secret is not None:
            sk = shared_secret
        else:
            env = os.environ.get("VERTEX_SWARM_SECRET", "")
            sk = env.encode("utf-8") if env else SwarmSigner.random_keypair()[0]
        if len(sk) < 32:
            sk = (sk * 8)[:32]
        self.signer = SwarmSigner(node_id, sk[:32])
        self._peer_ids: list[str] = []
        self._vote: Optional[LeaderlessVoteCollector] = None
        self._echo_vote_keys: Set[Tuple[str, str]] = set()
        self.auto_echo_votes = os.environ.get("VERTEX_VOTE_ECHO", "1") == "1"

    def set_peer_roster(self, ids: list[str]) -> None:
        self._peer_ids = sorted({str(i) for i in ids if str(i) != self.node_id} | {self.node_id})

    def start(self) -> None:
        self.vertex_lib.load_native()
        self.foxmq_cluster.join_cluster()
        self.vertex.set_message_handler(self._on_vertex_message)

    def shutdown(self) -> None:
        try:
            self.vertex.shutdown()
        except Exception:
            pass

    def _on_vertex_message(self, sender: str, msg: Dict[str, Any]) -> None:
        if self._vote is not None:
            self._vote.record(sender, msg)
        if msg.get("type") == "VERTEX_SWARM_VOTE" and self.auto_echo_votes:
            voter = str(msg.get("voter", ""))
            pid = str(msg.get("proposal_id", ""))
            choice = str(msg.get("choice", ""))
            if voter and voter != self.node_id and pid and choice:
                key = (pid, choice)
                if key not in self._echo_vote_keys:
                    self._echo_vote_keys.add(key)
                    self.vertex.broadcast(
                        {
                            "type": "VERTEX_SWARM_VOTE",
                            "proposal_id": pid,
                            "choice": choice,
                            "voter": self.node_id,
                            "quorum": msg.get("quorum", 0),
                        }
                    )
        if msg.get("type") != self.MSG_STATE:
            return
        inner = msg.get("payload")
        if not isinstance(inner, dict):
            return
        sig = msg.get("signature")
        if not isinstance(sig, (bytes, bytearray)) and not isinstance(sig, str):
            return
        sig_b = bytes.fromhex(sig) if isinstance(sig, str) else bytes(sig)
        if not self.signer.verify(inner, sig_b, sender):
            logger.debug("drop unsigned state from %s", sender)
            return
        self._apply_state_inner(inner)

    def _apply_state_inner(self, inner: Dict[str, Any]) -> None:
        op = inner.get("op")
        lp = int(inner.get("lamport", 0))
        signer = str(inner.get("signer", ""))
        if op == "role":
            self.state.set_role(str(inner.get("drone_id", "")), str(inner.get("role", "")), lp, signer)
        elif op == "chain":
            self.state.set_chain(list(inner.get("chain", [])), lp, signer)
        elif op == "victim":
            self.state.add_victim(str(inner.get("tag", "")))
        elif op == "pose":
            self.state.merge_pose(str(inner.get("drone_id", "")), dict(inner.get("xyz", {})), lp, signer)
        elif op == "hb":
            self.state.heartbeat_seen(str(inner.get("node_id", "")), float(inner.get("ts", time.time())))

    def submit_event(self, channel: str, key: str, value: Any, *, op: str = "kv") -> str:
        """Publish signed state to FoxMQ + fan-out on Vertex (consensus ordering via lamport)."""
        lam = self.state.tick_lamport(0)
        inner: Dict[str, Any] = {
            "op": op,
            "channel": channel,
            "key": key,
            "value": value,
            "lamport": lam,
            "signer": self.node_id,
        }
        if op == "role":
            inner["drone_id"] = key
            inner["role"] = str(value)
        elif op == "chain":
            inner["chain"] = list(value) if isinstance(value, (list, tuple)) else []
        elif op == "victim":
            inner["tag"] = str(value)
        elif op == "pose":
            inner["drone_id"] = key
            inner["xyz"] = dict(value) if isinstance(value, dict) else {}
        elif op == "hb":
            inner["node_id"] = key
            inner["ts"] = float(value) if value is not None else time.time()
        sig = self.signer.sign(inner)
        envelope = {
            "type": self.MSG_STATE,
            "payload": inner,
            "signature": sig.hex(),
            "event_id": uuid.uuid4().hex,
        }
        self.vertex.broadcast(envelope)
        try:
            from swarm.foxmq_integration import FoxMQTopic, MessageKind

            self.foxmq.publish(
                MessageKind.STATE,
                FoxMQTopic.STATE,
                {"vertex_swarm": envelope, "topic": state_topic(Channel(channel))},
            )
        except Exception as exc:  # pragma: no cover - optional stack
            logger.debug("FoxMQ publish skipped: %s", exc)
        self._apply_state_inner(inner)
        return str(envelope["event_id"])

    def leaderless_vote(self, choice: str, *, wait_s: float = 0.35) -> Dict[str, Any]:
        peers = self._peer_ids or [self.node_id]
        self._vote = LeaderlessVoteCollector(self.node_id, peers)
        try:
            return self._vote.propose_and_collect(self.vertex.broadcast, choice, wait_s=wait_s)
        finally:
            self._vote = None
