"""Per-link mesh impairment, scenario timelines, mock sensor events, and metrics.

Wire-up
-------
1. Create a shared ``NetworkSimulator`` and pass it to ``NetworkEmulator(sim)``.
2. Register nodes, then use ``VertexNode(id, net)`` as today; broadcasts flow through
   per-edge loss/latency and ``_sent_time`` latency accounting.
3. Optional JSON timeline (see ``scenario.example.json`` or
   ``scenarios/scenario1_baseline_daisy_chain.json`` for Dynamic Daisy Chain):
   pass ``scenario_path=...``
   or ``scenario_events=[...]`` into ``DroneController`` together with the same
   ``network_sim`` instance, or run ``ScenarioRunner(sim, events).start_daemon()``.
4. Live graph: ``start_mesh_stats_http_server(sim, port=8766)`` then open
   ``swarm/static/mesh_dashboard.html`` in a browser (stats URL
   ``http://127.0.0.1:8766/mesh_stats``). The JSON includes ``logical_mesh`` when
   nodes call ``set_mesh_node_view`` (distance-vector neighbors + routes). Or run
   ``PYTHONPATH=. python swarm/demo_mesh_http.py``.
5. Unconfigured edges default to open (deliver, zero loss). Call
   ``set_default_open(False)`` to require explicit ``set_link`` for every pair.
"""

from __future__ import annotations

import json
import logging
import random
import threading
import time
from collections import defaultdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable, DefaultDict, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

LinkKey = Tuple[str, str]
LinkParams = Dict[str, Any]
StatsRow = Dict[str, Any]

DEFAULT_OPEN = True  # if True, unspecified (src,dst) delivers with 0 loss / 0 latency


class NetworkSimulator:
    """Directed link state: loss, latency, status; counters and optional event log."""

    def __init__(self, mesh_id: str = "mesh") -> None:
        self.mesh_id = mesh_id
        self.links: Dict[LinkKey, LinkParams] = {}
        self.lock = threading.Lock()
        self.stats: DefaultDict[LinkKey, StatsRow] = defaultdict(
            lambda: {"sent": 0, "recv": 0, "dropped": 0, "total_latency": 0.0}
        )
        self.event_log: List[Tuple[str, float, str, str, Any]] = []
        self._log_max = 5000
        self._default_open = DEFAULT_OPEN
        # Optional per-node mesh routing / neighbor views for dashboards (not used in should_deliver).
        self._mesh_node_views: Dict[str, Dict[str, Any]] = {}

    def set_default_open(self, open_links: bool) -> None:
        """If True, pairs with no explicit link entry behave as up with zero loss/latency."""
        with self.lock:
            self._default_open = open_links

    def set_link(
        self,
        src: str,
        dst: str,
        loss: float = 0.0,
        latency: float = 0.0,
        status: str = "up",
        asymmetric: bool = False,
    ) -> None:
        """Configure directed edge src -> dst. If asymmetric is True, do not mirror reverse."""
        with self.lock:
            self.links[(src, dst)] = {
                "loss": float(loss),
                "latency": float(latency),
                "status": status,
                "asymmetric": asymmetric,
            }

    def set_link_bidirectional(
        self,
        a: str,
        b: str,
        loss_ab: float = 0.0,
        latency_ab: float = 0.0,
        loss_ba: Optional[float] = None,
        latency_ba: Optional[float] = None,
        status: str = "up",
    ) -> None:
        """Symmetric or asymmetric pair; reverse uses loss_ba/latency_ba when provided."""
        self.set_link(a, b, loss=loss_ab, latency=latency_ab, status=status, asymmetric=True)
        self.set_link(
            b,
            a,
            loss=loss_ab if loss_ba is None else loss_ba,
            latency=latency_ab if latency_ba is None else latency_ba,
            status=status,
            asymmetric=True,
        )

    def _effective_link(self, src: str, dst: str) -> Optional[LinkParams]:
        key = (src, dst)
        if key in self.links:
            return self.links[key]
        if self._default_open:
            return {
                "loss": 0.0,
                "latency": 0.0,
                "status": "up",
                "asymmetric": False,
            }
        return None

    def should_deliver(self, src: str, dst: str, payload: Dict[str, Any]) -> bool:
        with self.lock:
            link = self._effective_link(src, dst)
            if not link or link["status"] not in ("up", "degraded"):
                self._record_drop(src, dst, payload)
                return False
            eff_loss = float(link["loss"])
            if link["status"] == "degraded":
                eff_loss = min(1.0, eff_loss + 0.15)
            if random.random() < eff_loss:
                self._record_drop(src, dst, payload)
                return False
            return True

    def get_latency(self, src: str, dst: str) -> float:
        with self.lock:
            link = self._effective_link(src, dst)
            if link:
                return float(link["latency"])
            return 0.0

    def configured_loss(self, src: str, dst: str) -> float:
        """Expected loss on directed edge (config only; ignores random drops)."""
        with self.lock:
            link = self._effective_link(src, dst)
            if not link or link["status"] not in ("up", "degraded"):
                return 1.0
            loss = float(link["loss"])
            if link["status"] == "degraded":
                loss = min(1.0, loss + 0.15)
            return loss

    def set_mesh_node_view(self, node_id: str, view: Dict[str, Any]) -> None:
        with self.lock:
            self._mesh_node_views[node_id] = dict(view)

    def clear_mesh_node_view(self, node_id: str) -> None:
        with self.lock:
            self._mesh_node_views.pop(node_id, None)

    def record_send(self, src: str, dst: str, payload: Dict[str, Any]) -> None:
        with self.lock:
            key = (src, dst)
            self.stats[key]["sent"] += 1
            self._trim_log()
            self.event_log.append(("send", time.time(), src, dst, payload.get("type")))

    def record_recv(self, src: str, dst: str, payload: Dict[str, Any], latency: float) -> None:
        with self.lock:
            key = (src, dst)
            self.stats[key]["recv"] += 1
            self.stats[key]["total_latency"] += float(latency)
            self._trim_log()
            self.event_log.append(("recv", time.time(), src, dst, payload.get("type")))

    def _record_drop(self, src: str, dst: str, payload: Dict[str, Any]) -> None:
        key = (src, dst)
        self.stats[key]["dropped"] += 1
        self._trim_log()
        self.event_log.append(("drop", time.time(), src, dst, payload.get("type")))

    def _trim_log(self) -> None:
        if len(self.event_log) > self._log_max:
            del self.event_log[: len(self.event_log) - self._log_max]

    def get_link_stats(self) -> Dict[str, Dict[str, Any]]:
        """Serializable link stats: keys 'src|dst'."""
        with self.lock:
            out: Dict[str, Dict[str, Any]] = {}
            keys = set(self.links.keys()) | set(self.stats.keys())
            for src, dst in keys:
                link = self._effective_link(src, dst)
                st = self.stats[(src, dst)]
                k = f"{src}|{dst}"
                if link:
                    out[k] = {
                        "src": src,
                        "dst": dst,
                        "loss": link["loss"],
                        "latency": link["latency"],
                        "status": link["status"],
                        "sent": st["sent"],
                        "recv": st["recv"],
                        "dropped": st["dropped"],
                        "delivery_ratio": _delivery_ratio(st),
                        "avg_latency": _avg_latency(st),
                    }
                elif st["sent"] or st["recv"] or st["dropped"]:
                    out[k] = {
                        "src": src,
                        "dst": dst,
                        "loss": 0.0,
                        "latency": 0.0,
                        "status": "default_open",
                        "sent": st["sent"],
                        "recv": st["recv"],
                        "dropped": st["dropped"],
                        "delivery_ratio": _delivery_ratio(st),
                        "avg_latency": _avg_latency(st),
                    }
            return out

    def get_swarm_stats(self) -> Dict[str, Any]:
        with self.lock:
            total_sent = sum(s["sent"] for s in self.stats.values())
            total_recv = sum(s["recv"] for s in self.stats.values())
            total_drop = sum(s["dropped"] for s in self.stats.values())
            attempts = total_sent + total_drop
            return {
                "mesh_id": self.mesh_id,
                "total_sent": total_sent,
                "total_recv": total_recv,
                "total_dropped": total_drop,
                "delivery_ratio": (total_sent / attempts) if attempts else 1.0,
                "links_configured": len(self.links),
                "event_log_len": len(self.event_log),
            }

    def get_mesh_snapshot(self) -> Dict[str, Any]:
        """Single JSON blob for HTTP / WebSocket dashboards."""
        with self.lock:
            views = dict(self._mesh_node_views)
        return {
            "mesh_id": self.mesh_id,
            "ts": time.time(),
            "links": self.get_link_stats(),
            "swarm": self.get_swarm_stats(),
            "logical_mesh": views,
        }

    def apply_scenario_event(self, ev: Dict[str, Any]) -> None:
        """Apply one scenario dict: type set_link | set_default | clear_links."""
        t = ev.get("type")
        if t == "set_link":
            self.set_link(
                str(ev["src"]),
                str(ev["dst"]),
                loss=float(ev.get("loss", 0.0)),
                latency=float(ev.get("latency", 0.0)),
                status=str(ev.get("status", "up")),
                asymmetric=bool(ev.get("asymmetric", False)),
            )
        elif t == "set_link_pair":
            self.set_link_bidirectional(
                str(ev["a"]),
                str(ev["b"]),
                loss_ab=float(ev.get("loss_ab", 0.0)),
                latency_ab=float(ev.get("latency_ab", 0.0)),
                loss_ba=ev.get("loss_ba"),
                latency_ba=ev.get("latency_ba"),
                status=str(ev.get("status", "up")),
            )
        elif t == "set_default_open":
            self.set_default_open(bool(ev.get("open", True)))
        elif t == "clear_links":
            with self.lock:
                self.links.clear()


def _delivery_ratio(st: StatsRow) -> float:
    attempts = st["sent"] + st["dropped"]
    if attempts <= 0:
        return 1.0
    return st["sent"] / attempts


def _avg_latency(st: StatsRow) -> float:
    if st["recv"] <= 0:
        return 0.0
    return st["total_latency"] / st["recv"]


class ScenarioRunner:
    """Sleep-scheduled scenario events on a background thread."""

    def __init__(
        self,
        sim: NetworkSimulator,
        events: List[Dict[str, Any]],
        *,
        on_complete: Optional[Callable[[], None]] = None,
    ) -> None:
        self.sim = sim
        self.events = sorted(events, key=lambda e: float(e.get("time", 0.0)))
        self._on_complete = on_complete
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def run_blocking(self) -> None:
        start = time.time()
        for ev in self.events:
            if self._stop.is_set():
                break
            t = float(ev.get("time", 0.0))
            now = time.time() - start
            if now < t:
                remaining = t - now
                if self._stop.wait(timeout=remaining):
                    break
            if self._stop.is_set():
                break
            self.sim.apply_scenario_event(ev)
            logger.debug("scenario event at t=%s: %s", t, ev.get("type"))
        if self._on_complete and not self._stop.is_set():
            self._on_complete()

    def start_daemon(self) -> threading.Thread:
        def _run() -> None:
            try:
                self.run_blocking()
            except Exception:  # pragma: no cover - defensive
                logger.exception("scenario runner failed")

        self._thread = threading.Thread(target=_run, daemon=True, name="ScenarioRunner")
        self._thread.start()
        return self._thread


class MockDataGenerator:
    """Configurable mock victims, hazards, battery noise, and environmental telemetry.

    Generates fallback data for any drone ID — not limited to ``aerial`` prefixes.
    Event types produced:
    - ``VICTIM_DETECTED`` – periodic victim sightings at random locations.
    - ``HAZARD_DETECTED`` – structural hazards (rubble, gas leak, flood).
    - ``ENVIRONMENT_READING`` – temperature, CO₂, humidity snapshots.
    - ``HEARTBEAT_MOCK`` – lightweight keep-alive with battery & position.
    """

    HAZARD_TYPES: List[str] = ["rubble", "gas_leak", "structural_damage", "flood", "fire"]
    ENVIRONMENT_KEYS: List[str] = ["temperature_c", "co2_ppm", "humidity_pct", "dust_density"]

    def __init__(
        self,
        drone_id: str,
        area_bounds: Tuple[float, float, float, float],
        *,
        victim_interval: float = 30.0,
        hazard_interval: float = 45.0,
        environment_interval: float = 10.0,
        heartbeat_interval: float = 5.0,
        seed: Optional[int] = None,
    ) -> None:
        self.drone_id = drone_id
        self.area_bounds = area_bounds
        self.victim_interval = victim_interval
        self.hazard_interval = hazard_interval
        self.environment_interval = environment_interval
        self.heartbeat_interval = heartbeat_interval
        self.last_victim_time = 0.0
        self.last_hazard_time = 0.0
        self.last_env_time = 0.0
        self.last_heartbeat_time = 0.0
        self._rng = random.Random(seed)
        self.battery_pct = 100.0
        self.battery_drain_per_sec = 0.01
        self._position: List[float] = [
            self._rng.uniform(area_bounds[0], area_bounds[1]),
            self._rng.uniform(area_bounds[2], area_bounds[3]),
            0.0,
        ]
        self._victim_count = 0
        self._hazard_count = 0

    # ------------------------------------------------------------------
    # Battery
    # ------------------------------------------------------------------

    def tick_battery(self, dt: float) -> None:
        self.battery_pct = max(0.0, self.battery_pct - self.battery_drain_per_sec * dt)

    def set_position(self, x: float, y: float, z: float = 0.0) -> None:
        """Update the mock position (useful when GPS adapter feeds real coords)."""
        self._position = [x, y, z]

    # ------------------------------------------------------------------
    # Random-point helper
    # ------------------------------------------------------------------

    def _random_point(self) -> List[float]:
        xmin, xmax, ymin, ymax = self.area_bounds
        return [
            round(self._rng.uniform(xmin, xmax), 2),
            round(self._rng.uniform(ymin, ymax), 2),
            0.0,
        ]

    # ------------------------------------------------------------------
    # Event generators
    # ------------------------------------------------------------------

    def _maybe_victim(self, now: float) -> Optional[Dict[str, Any]]:
        if now - self.last_victim_time >= self.victim_interval:
            self.last_victim_time = now
            self._victim_count += 1
            return {
                "type": "VICTIM_DETECTED",
                "id": f"{self.drone_id}_v{self._victim_count}",
                "location": self._random_point(),
                "confidence": round(self._rng.uniform(0.65, 0.99), 3),
                "sensor": "mock",
                "drone_id": self.drone_id,
                "battery_pct": round(self.battery_pct, 1),
                "timestamp": now,
            }
        return None

    def _maybe_hazard(self, now: float) -> Optional[Dict[str, Any]]:
        if now - self.last_hazard_time >= self.hazard_interval:
            self.last_hazard_time = now
            self._hazard_count += 1
            return {
                "type": "HAZARD_DETECTED",
                "id": f"{self.drone_id}_h{self._hazard_count}",
                "hazard": self._rng.choice(self.HAZARD_TYPES),
                "severity": self._rng.choice(["low", "medium", "high", "critical"]),
                "location": self._random_point(),
                "drone_id": self.drone_id,
                "timestamp": now,
            }
        return None

    def _maybe_environment(self, now: float) -> Optional[Dict[str, Any]]:
        if now - self.last_env_time >= self.environment_interval:
            self.last_env_time = now
            return {
                "type": "ENVIRONMENT_READING",
                "drone_id": self.drone_id,
                "location": list(self._position),
                "temperature_c": round(self._rng.uniform(15.0, 45.0), 1),
                "co2_ppm": round(self._rng.uniform(400, 5000), 0),
                "humidity_pct": round(self._rng.uniform(20, 95), 1),
                "dust_density": round(self._rng.uniform(0.0, 1.0), 3),
                "timestamp": now,
            }
        return None

    def _maybe_heartbeat(self, now: float) -> Optional[Dict[str, Any]]:
        if now - self.last_heartbeat_time >= self.heartbeat_interval:
            self.last_heartbeat_time = now
            return {
                "type": "HEARTBEAT_MOCK",
                "drone_id": self.drone_id,
                "battery_pct": round(self.battery_pct, 1),
                "position": list(self._position),
                "timestamp": now,
            }
        return None

    # ------------------------------------------------------------------
    # Main generate — returns the highest-priority pending event
    # ------------------------------------------------------------------

    def generate(self, now: float) -> Optional[Dict[str, Any]]:
        """Return a mock event dict to broadcast, or ``None``.

        Checks in priority order: victim → hazard → environment → heartbeat.
        Only the first ready event is returned per call so the caller can
        broadcast at a natural cadence.
        """
        for gen in (self._maybe_victim, self._maybe_hazard, self._maybe_environment, self._maybe_heartbeat):
            event = gen(now)
            if event is not None:
                return event
        return None

    def generate_all(self, now: float) -> List[Dict[str, Any]]:
        """Return *all* pending events (useful for batch processing in tests)."""
        events: List[Dict[str, Any]] = []
        for gen in (self._maybe_victim, self._maybe_hazard, self._maybe_environment, self._maybe_heartbeat):
            event = gen(now)
            if event is not None:
                events.append(event)
        return events


def start_mesh_stats_http_server(
    sim: NetworkSimulator,
    host: str = "127.0.0.1",
    port: int = 8766,
) -> ThreadingHTTPServer:
    """Serve GET /mesh_stats as JSON for the static dashboard (stdlib only)."""

    sim_ref: Dict[str, NetworkSimulator] = {"sim": sim}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args: Any) -> None:
            logger.debug(fmt, *args)

        def do_GET(self) -> None:  # noqa: N802
            if self.path.startswith("/mesh_stats"):
                body = json.dumps(sim_ref["sim"].get_mesh_snapshot()).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif self.path == "/" or self.path.startswith("/index.html"):
                self.send_response(404)
                self.end_headers()
            else:
                self.send_response(404)
                self.end_headers()

    server = ThreadingHTTPServer((host, port), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True, name="MeshStatsHTTP")
    thread.start()
    return server
