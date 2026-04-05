"""Orchestrates chain policy, heartbeats, and consensus messaging on top of Vertex."""

from __future__ import annotations

import random
import time
from typing import Any, Callable, Dict, List, Optional

from swarm import config

from swarm.chain_manager import ChainManager, DroneRole
from swarm.coordination.consensus_engine import ConsensusEngine
from swarm.coordination.heartbeat_monitor import HeartbeatMonitor
from swarm.vertex_node import VertexNode


class SwarmCoordinator:
    """Composable coordination facade: liveness, role promotion hooks, broadcast votes."""

    MSG_HEARTBEAT = "HEARTBEAT"

    def __init__(
        self,
        node_id: str,
        vertex: VertexNode,
        chain: ChainManager,
        *,
        heartbeat: Optional[HeartbeatMonitor] = None,
        consensus: Optional[ConsensusEngine] = None,
        on_peer_dead: Optional[Callable[[str], None]] = None,
        on_peer_stale: Optional[Callable[[str], None]] = None,
    ) -> None:
        self.node_id = node_id
        self.vertex = vertex
        self.chain = chain
        self.heartbeat = heartbeat or HeartbeatMonitor()
        self.consensus = consensus or ConsensusEngine(vertex, node_id)
        self._on_peer_dead = on_peer_dead
        self._on_peer_stale = on_peer_stale
        self._votes: Dict[str, List[tuple]] = {}

    def publish_heartbeat(self, *, stake: float = 0.0, extra: Optional[Dict[str, Any]] = None) -> None:
        msg: Dict[str, Any] = {
            "type": self.MSG_HEARTBEAT,
            "node_id": self.node_id,
            "stake": float(stake),
            "role": self.chain.role.value,
            "ts": time.time(),
        }
        if extra:
            msg.update(extra)
        emu = self.vertex.emulator
        others = [p for p in emu.registered_node_ids() if p != self.node_id] if emu is not None else []
        thresh = int(getattr(config, "SCALABLE_PEER_COUNT_THRESHOLD", 16))
        fanout = int(getattr(config, "HEARTBEAT_FANOUT", 0))
        if emu is None or fanout <= 0 or len(others) < thresh:
            self.vertex.broadcast(msg)
            return
        k = min(fanout, len(others))
        for dest in random.sample(others, k):
            self.vertex.send(dest, msg)

    def handle_incoming(self, sender: str, msg: Dict[str, Any]) -> bool:
        """Return True if this coordinator consumed the message (no further app handling)."""
        mt = msg.get("type")
        if mt == self.MSG_HEARTBEAT:
            stake = float(msg.get("stake", 0.0))
            self.heartbeat.record(sender, stake=stake)
            return False

        if mt == ConsensusEngine.MSG_VOTE:
            pid = str(msg.get("proposal_id", ""))
            if not pid:
                return False
            choice = str(msg.get("choice", ""))
            voter = str(msg.get("voter", sender))
            stake = float(msg.get("stake", 0.0))
            self._votes.setdefault(pid, []).append((voter, choice, stake))
            return False

        if mt == ConsensusEngine.MSG_PROPOSAL:
            return False

        return False

    def tick(self, *, now: Optional[float] = None) -> List[str]:
        """Run heartbeat timeouts; return peers that became dead this tick."""
        return self.heartbeat.tick(
            now=now,
            on_stale=self._on_peer_stale,
            on_dead=self._on_peer_dead,
        )

    def clear_votes(self, proposal_id: str) -> None:
        self._votes.pop(str(proposal_id), None)

    def votes_for(self, proposal_id: str) -> List[tuple]:
        return list(self._votes.get(str(proposal_id), []))

    def _peer_eligible_for_promotion(self, peer_id: str, now: float) -> bool:
        st = self.heartbeat.peer_state(peer_id, now=now)
        if st is None:
            return True
        return st.state != "dead"

    def promote_standby_to_role(
        self,
        failed_peer: str,
        standby_ids: List[str],
        *,
        target_role: DroneRole,
        stake_for: Callable[[str], float],
        now: Optional[float] = None,
    ) -> Optional[str]:
        """Deterministic standby pick after a failure (stake-weighted, lexicographic tie-break)."""
        t0 = now if now is not None else time.time()
        base = [s for s in standby_ids if s != failed_peer]
        candidates = [s for s in base if self._peer_eligible_for_promotion(s, t0)]
        if not candidates:
            candidates = base
        if not candidates:
            return None
        best = max(candidates, key=lambda cid: (stake_for(cid), cid))
        if self.node_id == best:
            self.chain.role = target_role
        return best
