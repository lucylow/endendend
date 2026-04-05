"""Mesh fan-out for demos and tests; optional per-link impairment via NetworkSimulator.

For Scenario 1 (Dynamic Daisy Chain) depth/loss modeling constants and a packaged
timeline, see ``swarm/scenario_dynamic_daisy_chain.py`` and
``swarm/scenarios/scenario1_baseline_daisy_chain.json``.
"""

from __future__ import annotations

import random
import time
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional, Tuple, Union

from swarm import config
from swarm.serialization import unpack_wire

if TYPE_CHECKING:
    from swarm.network_simulator import NetworkSimulator

MessageHandler = Callable[[str, Dict[str, Any]], None]
WireInput = Union[Dict[str, Any], bytes]


class NetworkEmulator:
    """Deliver broadcasts to every registered node except the sender."""

    def __init__(self, network_sim: Optional["NetworkSimulator"] = None) -> None:
        self._handlers: List[Tuple[str, MessageHandler]] = []
        self._network_sim = network_sim

    @staticmethod
    def _normalize_message(message: WireInput) -> Dict[str, Any]:
        return unpack_wire(message)

    def _effective_hop_latency(self, src: str, dst: str, payload: Dict[str, Any]) -> float:
        sim = self._network_sim
        if sim is None:
            return 0.0
        lat = float(sim.get_latency(src, dst))
        if payload.get("priority") == "high":
            lat *= float(config.URGENT_LINK_LATENCY_SCALE)
        return max(0.0, lat)

    def set_network_simulator(self, network_sim: Optional["NetworkSimulator"]) -> None:
        self._network_sim = network_sim

    def register(self, node_id: str, on_message: MessageHandler) -> None:
        self._handlers.append((node_id, on_message))

    def unregister(self, node_id: str) -> None:
        self._handlers = [(nid, h) for nid, h in self._handlers if nid != node_id]

    def registered_node_ids(self) -> List[str]:
        return [nid for nid, _h in self._handlers]

    def fanout(self, sender_id: str, message: Dict[str, Any]) -> None:
        msg = dict(message)
        sent_ts = float(msg.get("_sent_time", time.monotonic()))
        clean = {k: v for k, v in msg.items() if k != "_sent_time"}
        sim = self._network_sim
        for nid, handler in self._handlers:
            if nid == sender_id:
                continue
            if sim is not None:
                if not sim.should_deliver(sender_id, nid, msg):
                    continue
                lat = sim.get_latency(sender_id, nid)
                if lat > 0:
                    time.sleep(lat)
                sim.record_send(sender_id, nid, msg)
                recv_latency = time.monotonic() - sent_ts
                sim.record_recv(sender_id, nid, clean, recv_latency)
            handler(sender_id, dict(clean))

    def unicast(self, sender_id: str, dest_id: str, message: WireInput) -> None:
        """Deliver a single message to one peer (same impairment model as fanout)."""
        msg = self._normalize_message(message)
        sent_ts = float(msg.get("_sent_time", time.monotonic()))
        clean = {k: v for k, v in msg.items() if k != "_sent_time"}
        sim = self._network_sim
        for nid, handler in self._handlers:
            if nid != dest_id:
                continue
            if sim is not None:
                if not sim.should_deliver(sender_id, nid, msg):
                    return
                lat = self._effective_hop_latency(sender_id, nid, msg)
                if lat > 0:
                    time.sleep(lat)
                sim.record_send(sender_id, nid, msg)
                recv_latency = time.monotonic() - sent_ts
                sim.record_recv(sender_id, nid, clean, recv_latency)
            handler(sender_id, dict(clean))
            return

    def fanout_sample(self, sender_id: str, message: Dict[str, Any], k: int) -> int:
        """Deliver to up to ``k`` distinct peers (random subset). Returns delivery attempts made."""
        msg = dict(message)
        sent_ts = float(msg.get("_sent_time", time.monotonic()))
        clean = {key: val for key, val in msg.items() if key != "_sent_time"}
        sim = self._network_sim
        candidates = [nid for nid, _handler in self._handlers if nid != sender_id]
        random.shuffle(candidates)
        take = max(0, min(int(k), len(candidates)))
        hmap = dict(self._handlers)
        delivered = 0
        for nid in candidates[:take]:
            handler = hmap.get(nid)
            if handler is None:
                continue
            if sim is not None:
                if not sim.should_deliver(sender_id, nid, msg):
                    continue
                lat = sim.get_latency(sender_id, nid)
                if lat > 0:
                    time.sleep(lat)
                sim.record_send(sender_id, nid, msg)
                recv_latency = time.monotonic() - sent_ts
                sim.record_recv(sender_id, nid, clean, recv_latency)
            handler(sender_id, dict(clean))
            delivered += 1
        return delivered
