"""P2P vertex: broadcast fan-out and optional multi-hop mesh (DV routing + flood)."""

from __future__ import annotations

import logging
import math
import queue
import random
import threading
import time
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional, Set, Tuple

from swarm import config
from swarm.routing import RoutingTable
from swarm.serialization import pack_wire

if TYPE_CHECKING:
    from swarm.byzantine import ByzantineInjector
    from swarm.network_emulator import NetworkEmulator
    from swarm.network_simulator import NetworkSimulator

logger = logging.getLogger(__name__)

MessageHandler = Callable[[str, Dict[str, Any]], None]

NEIGHBOR_LOSS_THRESHOLD = 0.5
FLOOD_TTL_DEFAULT = 12
FORWARD_TTL_DEFAULT = 16
_MAX_FLOOD_IDS = 4000
# Backward compatibility for tests (see config.ROUTING_PERIOD_BASE_SEC).
ROUTING_PERIOD_SEC = float(getattr(config, "ROUTING_PERIOD_BASE_SEC", 5.0))


class VertexNode:
    """Broadcast via NetworkEmulator; optional mesh uses unicast DV + controlled flood."""

    def __init__(
        self,
        node_id: str,
        emulator: Optional["NetworkEmulator"] = None,
        *,
        byzantine_injector: Optional["ByzantineInjector"] = None,
        mesh_routing: bool = False,
        network_sim: Optional["NetworkSimulator"] = None,
    ) -> None:
        self.node_id = node_id
        self.emulator = emulator
        self.byzantine_injector = byzantine_injector
        self._lamport = 0
        self._mesh_routing = bool(mesh_routing and emulator is not None and network_sim is not None)
        self._network_sim = network_sim if self._mesh_routing else None
        self.routing = RoutingTable(node_id)
        self.neighbors: Set[str] = set()
        self.neighbor_loss: Dict[str, float] = {}
        self._app_handler: Optional[MessageHandler] = None
        self._last_routing_tick = 0.0
        self._adv_seq = 0
        self._flood_seen: Set[str] = set()
        self._flood_seq = 0
        self._stop_processing = threading.Event()
        self._dispatch_thread: Optional[threading.Thread] = None
        self._high_prio_queue: queue.Queue = queue.Queue()
        self._low_prio_queue: queue.Queue = queue.Queue()
        self._async_priority = bool(getattr(config, "ASYNC_PRIORITY_QUEUES", False))
        self.known_peers: Set[str] = set()
        self._gossip_last_tick = 0.0
        self.messages_sent_total = 0
        self.messages_sent_window = 0
        self._metrics_window_start = time.monotonic()

    def set_mesh_routing(self, enabled: bool, network_sim: Optional["NetworkSimulator"] = None) -> None:
        """Enable or disable mesh mode (requires emulator + sim when enabling)."""
        if enabled:
            if self.emulator is None or network_sim is None:
                logger.warning("mesh_routing requires emulator and NetworkSimulator")
                self._mesh_routing = False
                self._network_sim = None
                return
            self._mesh_routing = True
            self._network_sim = network_sim
        else:
            if self._network_sim is not None:
                self._network_sim.clear_mesh_node_view(self.node_id)
            self._mesh_routing = False
            self._network_sim = None

    def set_message_handler(self, handler: Optional[MessageHandler]) -> None:
        self._app_handler = handler
        if self._async_priority and self._dispatch_thread is None:
            self._stop_processing.clear()
            self._dispatch_thread = threading.Thread(target=self._app_dispatch_loop, daemon=True)
            self._dispatch_thread.start()

    def shutdown(self) -> None:
        """Stop background dispatch threads (tests / clean teardown)."""
        self._stop_processing.set()
        if self._dispatch_thread is not None:
            self._dispatch_thread.join(timeout=2.0)
            self._dispatch_thread = None

    def _app_dispatch_loop(self) -> None:
        while not self._stop_processing.is_set():
            item: Optional[Tuple[str, Dict[str, Any]]] = None
            try:
                item = self._high_prio_queue.get_nowait()
            except queue.Empty:
                pass
            if item is None:
                try:
                    item = self._low_prio_queue.get(timeout=0.1)
                except queue.Empty:
                    continue
            sender, app_msg = item
            if self._app_handler:
                self._app_handler(sender, app_msg)

    def send_safety(self, message: Optional[Dict[str, Any]] = None) -> None:
        """Flood/broadcast safety-critical traffic with highest priority (bypasses DV next-hop)."""
        inner: Dict[str, Any] = dict(message or {})
        inner.setdefault("type", "SAFETY_STOP")
        inner["priority"] = "high"
        inner["_edge_sent_wall_s"] = time.time()
        if self._mesh_routing:
            self.mesh_flood(inner)
        else:
            self.broadcast(inner)

    def _to_wire(self, payload: Dict[str, Any]) -> Any:
        return pack_wire(payload, use_msgpack=bool(config.USE_MSGPACK))

    def _enqueue_app(self, logical_sender: str, app_msg: Dict[str, Any]) -> None:
        if logical_sender and logical_sender != self.node_id:
            self.known_peers.add(logical_sender)
        if self._app_handler is None:
            return
        if not self._async_priority:
            self._app_handler(logical_sender, app_msg)
            return
        if app_msg.get("priority") == "high":
            self._high_prio_queue.put((logical_sender, app_msg))
        else:
            self._low_prio_queue.put((logical_sender, app_msg))

    def _stamp_outgoing(self, message: Dict[str, Any]) -> Dict[str, Any]:
        self._lamport += 1
        payload = dict(message)
        payload.setdefault("sender", self.node_id)
        payload["_lamport"] = self._lamport
        payload["_sent_time"] = time.monotonic()
        if self.byzantine_injector is not None:
            transformed = self.byzantine_injector.transform(self.node_id, payload)
            if transformed is None:
                return {}
            payload = transformed
        return payload

    def _record_outbound(self, count: int) -> None:
        if count <= 0:
            return
        self.messages_sent_total += count
        self.messages_sent_window += count

    def scalability_snapshot(self, *, reset_window: bool = True) -> Dict[str, Any]:
        """Outbound message rate and peer awareness (for dashboards / scalability runs)."""
        now = time.monotonic()
        elapsed = max(1e-9, now - self._metrics_window_start)
        rate = self.messages_sent_window / elapsed
        snap: Dict[str, Any] = {
            "node_id": self.node_id,
            "messages_sent_total": self.messages_sent_total,
            "messages_sent_window": self.messages_sent_window,
            "outbound_rate_per_s": rate,
            "known_peer_count": len(self.known_peers),
            "neighbor_count": len(self.neighbors),
        }
        if reset_window:
            self.messages_sent_window = 0
            self._metrics_window_start = now
        return snap

    def registered_peer_count(self) -> int:
        if self.emulator is not None:
            return max(0, len(self.emulator.registered_node_ids()) - 1)
        return len(self.known_peers)

    def tick_peer_gossip(self, now: Optional[float] = None) -> None:
        """Periodic bounded peer digest to random peers (O(fanout) per node per interval)."""
        if self.emulator is None:
            return
        t = time.time() if now is None else float(now)
        interval = float(getattr(config, "GOSSIP_INTERVAL_SEC", 2.0))
        if t - self._gossip_last_tick < interval:
            return
        self._gossip_last_tick = t
        for nid in self.emulator.registered_node_ids():
            if nid != self.node_id:
                self.known_peers.add(nid)
        others = [p for p in self.emulator.registered_node_ids() if p != self.node_id]
        if not others:
            return
        cap = int(getattr(config, "GOSSIP_PEER_LIST_CAP", 20))
        digest = sorted({self.node_id, *self.known_peers})
        if len(digest) > cap:
            digest = digest[:cap]
        fanout = min(int(getattr(config, "GOSSIP_FANOUT", 3)), len(others))
        chosen = random.sample(others, fanout) if fanout < len(others) else list(others)
        msg = {"type": "GOSSIP_PEERS", "peers": digest, "ts": t}
        for dest in chosen:
            self.send(dest, msg)

    def _apply_gossip(self, sender: str, msg: Dict[str, Any]) -> None:
        self.known_peers.add(sender)
        for p in msg.get("peers") or []:
            if isinstance(p, str) and p and p != self.node_id:
                self.known_peers.add(p)

    def broadcast_sampled(self, message: Dict[str, Any], fanout: Optional[int] = None) -> None:
        """Unicast to a random subset of peers (epidemic-friendly); mesh mode still floods."""
        if self._mesh_routing:
            self.mesh_flood(message)
            return
        payload = self._stamp_outgoing(message)
        if not payload:
            return
        if self.emulator is None:
            return
        k = int(config.EXPLORATION_GOSSIP_FANOUT if fanout is None else fanout)
        n_other = len(self.emulator.registered_node_ids()) - 1
        if n_other <= 0:
            return
        sent = self.emulator.fanout_sample(self.node_id, payload, min(k, n_other))
        self._record_outbound(sent)

    def broadcast(self, message: Dict[str, Any]) -> None:
        if self._mesh_routing:
            self.mesh_flood(message)
            return
        payload = self._stamp_outgoing(message)
        if not payload:
            return
        if self.emulator is not None:
            n = max(0, len(self.emulator.registered_node_ids()) - 1)
            self._record_outbound(n)
            self.emulator.fanout(self.node_id, payload)

    def send(self, dest_id: str, message: Dict[str, Any]) -> None:
        payload = self._stamp_outgoing(message)
        if not payload:
            return
        if self.emulator is not None:
            self._record_outbound(1)
            self.emulator.unicast(self.node_id, dest_id, payload)

    def mesh_flood(self, inner: Dict[str, Any], *, ttl: int = FLOOD_TTL_DEFAULT) -> None:
        """Application-level flood across direct neighbors; forwards with dedup."""
        if not self._mesh_routing or self.emulator is None:
            self.broadcast(inner)
            return
        self._refresh_neighbors()
        self._flood_seq += 1
        flood_id = f"{self.node_id}:{self._flood_seq}:{random.randint(0, 1_000_000)}"
        wrapped: Dict[str, Any] = {
            "type": "MESH_FLOOD",
            "flood_id": flood_id,
            "ttl": ttl,
            "origin": self.node_id,
            "inner": dict(inner),
        }
        if not self.neighbors:
            if self._app_handler:
                self._app_handler(self.node_id, dict(inner))
            return
        for n in self.neighbors:
            self.send(n, dict(wrapped))

    def send_to(self, dest: str, payload: Dict[str, Any], *, ttl: int = FORWARD_TTL_DEFAULT) -> bool:
        """Unicast toward dest using the distance-vector next hop."""
        if not self._mesh_routing or self.emulator is None:
            logger.debug("send_to fallback: mesh off or no emulator")
            return False
        self._refresh_neighbors()
        row = self.routing.get_best(dest)
        if row is None:
            logger.debug("no route to %s from %s", dest, self.node_id)
            return False
        next_hop = row[0]
        if next_hop not in self.neighbors and next_hop != dest:
            logger.debug("next_hop %s not a direct neighbor of %s", next_hop, self.node_id)
        fwd = {
            "type": "MESH_FORWARD",
            "dest": dest,
            "payload": dict(payload),
            "source": self.node_id,
            "ttl": ttl,
        }
        self.send(next_hop, fwd)
        return True

    def send_redundant(
        self,
        dest: str,
        payload: Dict[str, Any],
        *,
        redundancy: int = 3,
        ttl: int = FORWARD_TTL_DEFAULT,
    ) -> int:
        """Send duplicate forwards via up to ``redundancy`` distinct next hops."""
        if not self._mesh_routing or self.emulator is None:
            return 0
        self._refresh_neighbors()
        hops = self.routing.get_next_hops(dest, k=redundancy)
        if not hops:
            return 0
        sent = 0
        for next_hop in hops:
            fwd = {
                "type": "MESH_FORWARD",
                "dest": dest,
                "payload": dict(payload),
                "source": self.node_id,
                "ttl": ttl,
            }
            self.send(next_hop, fwd)
            sent += 1
        return sent

    def tick_mesh(self, now: Optional[float] = None) -> None:
        """Refresh neighbors, age routes, periodic ROUTING_UPDATE to neighbors; update dashboard view."""
        if not self._mesh_routing or self.emulator is None or self._network_sim is None:
            return
        t = time.time() if now is None else float(now)
        self._refresh_neighbors()
        for n in self.neighbors:
            self.routing.add_route(n, n, 1, self._adv_seq)
        self.routing.cleanup_stale(max_age=30.0)
        base = float(getattr(config, "ROUTING_PERIOD_BASE_SEC", 5.0))
        period = base
        if getattr(config, "ROUTING_ADAPTIVE_ENABLED", False):
            nc = max(1, len(self.neighbors))
            period = base * (1.0 + math.log(nc) / 10.0)
        if t - self._last_routing_tick >= period:
            self._last_routing_tick = t
            self._adv_seq += 1
            max_d = int(getattr(config, "ROUTING_MAX_ADVERTISE_DESTS", 64))
            routes = self.routing.advertise(max_destinations=max_d)
            msg = {
                "type": "ROUTING_UPDATE",
                "routes": routes,
                "sender": self.node_id,
                "seq": self._adv_seq,
            }
            for n in self.neighbors:
                self.send(n, dict(msg))
        self._push_mesh_view(t)

    def dispatch_incoming(self, sender: str, msg: Dict[str, Any]) -> None:
        """Call from the NetworkEmulator-registered handler; mesh control plane then app."""
        mt = msg.get("type")
        if mt == "ROUTING_UPDATE":
            self._handle_routing_update(sender, msg.get("routes") or [], int(msg.get("seq", 0)))
            return
        if mt == "MESH_FORWARD":
            self._handle_forward(
                sender,
                str(msg.get("dest", "")),
                msg.get("payload"),
                int(msg.get("ttl", FORWARD_TTL_DEFAULT)),
                str(msg.get("source", sender)),
            )
            return
        if mt == "MESH_FLOOD":
            self._handle_flood(
                sender,
                str(msg.get("flood_id", "")),
                int(msg.get("ttl", 0)),
                str(msg.get("origin", sender)),
                msg.get("inner"),
            )
            return
        if mt == "GOSSIP_PEERS":
            self._apply_gossip(sender, msg)
            return
        self._enqueue_app(sender, msg)

    def _deliver_app(self, logical_sender: str, app_msg: Dict[str, Any]) -> None:
        self._enqueue_app(logical_sender, app_msg)

    def _handle_routing_update(self, sender: str, routes: List[Any], packet_seq: int) -> None:
        for item in routes:
            if not isinstance(item, (list, tuple)) or len(item) < 2:
                continue
            dest = str(item[0])
            cost = int(item[1])
            new_cost = cost + 1
            self.routing.add_route(dest, sender, new_cost, packet_seq)

    def _handle_forward(
        self,
        sender: str,
        dest: str,
        payload: Any,
        ttl: int,
        source: str,
    ) -> None:
        if ttl <= 0 or not isinstance(payload, dict):
            return
        if dest == self.node_id:
            self._deliver_app(source, payload)
            return
        row = self.routing.get_best(dest)
        if row is None:
            logger.debug("forward stuck at %s for dest=%s", self.node_id, dest)
            return
        next_hop = row[0]
        if next_hop == sender:
            alts = self.routing.get_next_hops(dest, k=3)
            for h in alts:
                if h != sender:
                    next_hop = h
                    break
        fwd = {
            "type": "MESH_FORWARD",
            "dest": dest,
            "payload": dict(payload),
            "source": source,
            "ttl": ttl - 1,
        }
        self.send(next_hop, fwd)

    def _handle_flood(
        self,
        sender: str,
        flood_id: str,
        ttl: int,
        origin: str,
        inner: Any,
    ) -> None:
        if not flood_id or ttl <= 0:
            return
        if flood_id in self._flood_seen:
            return
        if len(self._flood_seen) >= _MAX_FLOOD_IDS:
            self._flood_seen.clear()
        self._flood_seen.add(flood_id)
        if isinstance(inner, dict):
            self._deliver_app(origin, dict(inner))
        self._refresh_neighbors()
        if ttl <= 1:
            return
        out = {
            "type": "MESH_FLOOD",
            "flood_id": flood_id,
            "ttl": ttl - 1,
            "origin": origin,
            "inner": inner if isinstance(inner, dict) else {},
        }
        for n in self.neighbors:
            if n != sender:
                self.send(n, dict(out))

    def _refresh_neighbors(self) -> None:
        if self.emulator is None or self._network_sim is None:
            return
        sim = self._network_sim
        peers = [p for p in self.emulator.registered_node_ids() if p != self.node_id]
        new_neighbors: Set[str] = set()
        loss_map: Dict[str, float] = {}
        for p in peers:
            loss = sim.configured_loss(self.node_id, p)
            loss_map[p] = loss
            if loss < NEIGHBOR_LOSS_THRESHOLD:
                new_neighbors.add(p)
        removed = self.neighbors - new_neighbors
        for r in removed:
            self.routing.remove_routes_via(r)
        self.neighbors = new_neighbors
        self.neighbor_loss = {k: loss_map[k] for k in new_neighbors}

    def _push_mesh_view(self, ts: float) -> None:
        if self._network_sim is None:
            return
        self._network_sim.set_mesh_node_view(
            self.node_id,
            {
                "node_id": self.node_id,
                "ts": ts,
                "neighbors": sorted(self.neighbors),
                "neighbor_loss": dict(self.neighbor_loss),
                "routes": self.routing.snapshot(),
            },
        )
