"""Backend service layer for the Vertex / FoxMQ swarm stack.

This module sits on top of the FoxMQ runtime and provides mission CRUD, fleet
views, optional FastAPI HTTP + WebSocket surfaces, an audit ledger, and a small
scheduler. FoxMQ remains the coordination fabric; this layer is a coordinator
and read model, not the source of truth for mesh state.
"""

from __future__ import annotations

import json
import logging
import random
import threading
from collections import defaultdict, deque
from dataclasses import asdict, dataclass, field, fields
from enum import Enum
from pathlib import Path
from typing import Any, DefaultDict, Deque, Dict, List, Optional, Sequence, Set

try:  # pragma: no cover - optional backend dependency
    from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import PlainTextResponse
    import uvicorn
except Exception:  # pragma: no cover - optional backend dependency
    FastAPI = Any  # type: ignore[assignment]
    HTTPException = Exception  # type: ignore[assignment]
    WebSocket = Any  # type: ignore[assignment]
    WebSocketDisconnect = Exception  # type: ignore[assignment]
    CORSMiddleware = Any  # type: ignore[assignment]
    PlainTextResponse = Any  # type: ignore[assignment]
    uvicorn = None  # type: ignore[assignment]

from swarm.foxmq_integration import (
    FoxMQBridge,
    FoxMQTopic,
    MessageKind,
    SwarmStateStore,
    current_time_ms,
    make_foxmq_bridge,
)

LOG = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Backend settings and persistence
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class BackendSettings:
    """Settings for the mission backend."""

    host: str = "0.0.0.0"
    port: int = 8080
    cors_origins: List[str] = field(default_factory=lambda: ["*"])
    data_dir: Path = Path(".backend")
    mission_state_path: Path = Path(".backend/mission_state.json")
    event_log_path: Path = Path(".backend/backend.events.jsonl")
    metric_snapshot_path: Path = Path(".backend/metrics.json")
    enable_websocket: bool = True
    enable_metrics: bool = True
    enable_simulation: bool = True
    max_history: int = 5000
    default_mission_ttl_s: int = 1800
    default_command_ttl_s: int = 20
    heartbeat_grace_s: int = 10
    stale_peer_s: int = 30
    dead_peer_s: int = 90

    def __post_init__(self) -> None:
        self.data_dir = Path(self.data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.mission_state_path = Path(self.mission_state_path)
        self.event_log_path = Path(self.event_log_path)
        self.metric_snapshot_path = Path(self.metric_snapshot_path)
        self.mission_state_path.parent.mkdir(parents=True, exist_ok=True)
        self.event_log_path.parent.mkdir(parents=True, exist_ok=True)
        self.metric_snapshot_path.parent.mkdir(parents=True, exist_ok=True)


class JSONFileStore:
    """Small durable store for backend state and view models."""

    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()

    def load(self, default: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if default is None:
            default = {}
        if not self.path.exists():
            return default.copy()
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            LOG.exception("could not load JSON store: %s", self.path)
            return default.copy()

    def save(self, data: Dict[str, Any]) -> None:
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        with self._lock:
            tmp.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
            tmp.replace(self.path)


# ---------------------------------------------------------------------------
# Mission state and repository
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class MissionState:
    mission_id: str
    name: str
    description: str = ""
    status: str = "draft"
    created_at_ms: int = 0
    updated_at_ms: int = 0
    started_at_ms: Optional[int] = None
    finished_at_ms: Optional[int] = None
    target_count: int = 0
    active_nodes: List[str] = field(default_factory=list)
    roles: Dict[str, str] = field(default_factory=dict)
    tasks: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    handoffs: List[Dict[str, Any]] = field(default_factory=list)
    alerts: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def touch(self) -> None:
        self.updated_at_ms = current_time_ms()


def _mission_from_payload(payload: Dict[str, Any]) -> MissionState:
    names = {f.name for f in fields(MissionState)}
    return MissionState(**{k: v for k, v in payload.items() if k in names})


class MissionRepository:
    """Persistent repository for mission objects."""

    def __init__(self, store: JSONFileStore) -> None:
        self.store = store
        self._lock = threading.RLock()
        self._missions: Dict[str, MissionState] = {}
        self._load()

    def _load(self) -> None:
        data = self.store.load({"missions": {}})
        missions = data.get("missions", {})
        with self._lock:
            for mission_id, payload in missions.items():
                try:
                    self._missions[mission_id] = _mission_from_payload(dict(payload))
                except Exception:
                    LOG.exception("skip corrupt mission record %s", mission_id)

    def persist(self) -> None:
        with self._lock:
            payload = {"missions": {mid: asdict(m) for mid, m in self._missions.items()}}
        self.store.save(payload)

    def list(self) -> List[MissionState]:
        with self._lock:
            return sorted(self._missions.values(), key=lambda m: (m.status, m.updated_at_ms), reverse=True)

    def get(self, mission_id: str) -> Optional[MissionState]:
        with self._lock:
            return self._missions.get(mission_id)

    def create(
        self,
        name: str,
        description: str = "",
        *,
        mission_id: Optional[str] = None,
        target_count: int = 0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MissionState:
        mission_id = mission_id or f"mission-{random.getrandbits(40):010x}"
        now = current_time_ms()
        mission = MissionState(
            mission_id=mission_id,
            name=name,
            description=description,
            created_at_ms=now,
            updated_at_ms=now,
            target_count=target_count,
            metadata=metadata or {},
        )
        with self._lock:
            self._missions[mission_id] = mission
        self.persist()
        return mission

    def upsert(self, mission: MissionState) -> MissionState:
        with self._lock:
            mission.touch()
            self._missions[mission.mission_id] = mission
        self.persist()
        return mission

    def delete(self, mission_id: str) -> bool:
        with self._lock:
            removed = self._missions.pop(mission_id, None) is not None
        if removed:
            self.persist()
        return removed

    def update_status(self, mission_id: str, status: str) -> MissionState:
        with self._lock:
            mission = self._missions.get(mission_id)
            if mission is None:
                raise KeyError(mission_id)
            mission.status = status
            if status == "running" and mission.started_at_ms is None:
                mission.started_at_ms = current_time_ms()
            if status in {"completed", "failed", "cancelled"}:
                mission.finished_at_ms = current_time_ms()
            mission.touch()
        self.persist()
        return mission

    def record_handoff(self, mission_id: str, handoff: Dict[str, Any]) -> MissionState:
        with self._lock:
            mission = self._missions.get(mission_id)
            if mission is None:
                raise KeyError(mission_id)
            mission.handoffs.append(handoff)
            mission.touch()
        self.persist()
        return mission

    def add_task(self, mission_id: str, task_id: str, payload: Dict[str, Any]) -> MissionState:
        with self._lock:
            mission = self._missions.get(mission_id)
            if mission is None:
                raise KeyError(mission_id)
            mission.tasks[task_id] = payload
            mission.touch()
        self.persist()
        return mission

    def add_alert(self, mission_id: str, alert: Dict[str, Any]) -> MissionState:
        with self._lock:
            mission = self._missions.get(mission_id)
            if mission is None:
                raise KeyError(mission_id)
            mission.alerts.append(alert)
            mission.touch()
        self.persist()
        return mission

    def update_roles(self, mission_id: str, roles: Dict[str, str]) -> MissionState:
        with self._lock:
            mission = self._missions.get(mission_id)
            if mission is None:
                raise KeyError(mission_id)
            mission.roles = roles.copy()
            mission.active_nodes = sorted(roles.keys())
            mission.touch()
        self.persist()
        return mission


# ---------------------------------------------------------------------------
# Presence view, commands, Prometheus
# ---------------------------------------------------------------------------


class MeshPresenceTracker:
    """Read-only presence summary derived from :class:`SwarmStateStore` peer records."""

    def __init__(self, state_store: SwarmStateStore, *, stale_peer_s: int, dead_peer_s: int) -> None:
        self.state_store = state_store
        self.stale_peer_s = stale_peer_s
        self.dead_peer_s = dead_peer_s

    def summary(self) -> Dict[str, Any]:
        now = current_time_ms()
        snap = self.state_store.snapshot()
        peer_rows: List[Dict[str, Any]] = []
        for pid, pdata in snap.peers.items():
            age_s = (now - int(pdata.get("last_seen_ms", 0))) / 1000.0
            peer_rows.append({"node_id": pid, "age_s": round(age_s, 3), **pdata})
        return {
            "local_node": snap.node_id,
            "peer_count": len(snap.peers),
            "peers": sorted(peer_rows, key=lambda r: r["node_id"]),
            "ts_ms": now,
        }

    def sweep(self) -> Dict[str, List[str]]:
        now = current_time_ms()
        stale: List[str] = []
        dead: List[str] = []
        for pid, pdata in self.state_store.snapshot().peers.items():
            age_s = (now - int(pdata.get("last_seen_ms", 0))) / 1000.0
            if age_s >= self.dead_peer_s:
                dead.append(pid)
            elif age_s >= self.stale_peer_s:
                stale.append(pid)
        return {"stale": stale, "dead": dead}


class RemoteCommand(str, Enum):
    GET_HEALTH = "get_health"
    REQUEST_SYNC = "request_sync"
    FORCE_RESYNC = "force_resync"
    PUBLISH_STATE = "publish_state"


@dataclass(slots=True)
class CommandResponse:
    ok: bool
    message: str = ""
    data: Dict[str, Any] = field(default_factory=dict)


def mesh_tashi_projection(
    node: Dict[str, Any],
    *,
    missions_brief: Optional[List[Dict[str, Any]]] = None,
    history_tail: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Stable, UI-oriented slice of mesh state + mission hints for Tashi / Vertex dashboards.

    FoxMQ + LWW registers remain authoritative; this projection is read-only metadata for HTTP/WS clients.
    """
    registers = node.get("registers") or {}
    keys = sorted(str(k) for k in registers.keys())
    return {
        "mesh": {
            "nodeId": node.get("node_id"),
            "swarmId": node.get("swarm_id"),
            "version": node.get("version"),
            "updatedAtMs": node.get("updated_at_ms"),
            "role": node.get("role"),
            "status": node.get("status"),
            "depth": node.get("depth"),
            "peerCount": len(node.get("peers") or {}),
            "taskCount": len(node.get("tasks") or {}),
            "alertCount": len(node.get("alerts") or []),
        },
        "registers": {"keys": keys, "worldMap": registers.get("world_map")},
        "chainHint": {
            "monotonicMeshVersion": node.get("version"),
            "meshClockMs": node.get("updated_at_ms"),
            "storeMetrics": dict(node.get("metrics") or {}),
        },
        "missionsBrief": list(missions_brief or []),
        "historyTail": list(history_tail or [])[-12:],
    }


def public_command_result(response: Optional[CommandResponse]) -> Dict[str, Any]:
    """Normalize command responses for HTTP/WS (flat ``ok``/``result``/``error`` plus embedded ``response``)."""
    if response is None:
        return {"ok": True, "result": {}, "error": None, "async": True, "response": None}
    d = asdict(response)
    ok = bool(d.get("ok"))
    return {
        "ok": ok,
        "result": dict(d.get("data") or {}),
        "error": None if ok else str(d.get("message") or ""),
        "async": False,
        "response": d,
    }


class SwarmCommandRouter:
    """Dispatches local mesh commands; best-effort async fan-out for remote targets."""

    def __init__(self, bridge: FoxMQBridge) -> None:
        self.bridge = bridge

    def send(self, target_id: str, command: RemoteCommand, args: Dict[str, Any], *, wait: bool = True) -> Optional[CommandResponse]:
        store = self.bridge.adapter.state_store
        client = self.bridge.adapter.client
        if target_id == store.node_id:
            return self._local(command, args)
        if wait:
            raise ValueError(f"synchronous remote command to {target_id!r} is not supported; pass wait=false for fire-and-forget")
        payload = {
            "backend_command": command.value,
            "args": args,
            "requester_id": store.node_id,
            "ts_ms": current_time_ms(),
        }
        client.publish(MessageKind.CUSTOM, FoxMQTopic.STATE, payload, reliable=False)
        return None

    def _local(self, command: RemoteCommand, args: Dict[str, Any]) -> CommandResponse:
        adapter = self.bridge.adapter
        client = adapter.client
        if command is RemoteCommand.GET_HEALTH:
            return CommandResponse(True, data=adapter.health_summary())
        if command is RemoteCommand.REQUEST_SYNC:
            adapter.request_full_sync()
            return CommandResponse(True, message="sync_requested")
        if command is RemoteCommand.FORCE_RESYNC:
            client.force_resync()
            return CommandResponse(True, message="resync_forced")
        if command is RemoteCommand.PUBLISH_STATE:
            client.publish_state_snapshot()
            return CommandResponse(True, message="state_published")
        return CommandResponse(False, message=f"unhandled_local_command:{command.value}")


class PrometheusTextExporter:
    """Minimal Prometheus text snapshot for dashboards."""

    def __init__(self, state_store: SwarmStateStore, presence: MeshPresenceTracker) -> None:
        self.state_store = state_store
        self.presence = presence

    def render(self) -> str:
        lines: List[str] = []
        for key, val in self.state_store.get_metrics().items():
            if isinstance(val, bool):
                lines.append(f'foxmq_store_metric{{node_id="{self.state_store.node_id}",key="{key}"}} {1 if val else 0}')
            elif isinstance(val, (int, float)):
                lines.append(f'foxmq_store_metric{{node_id="{self.state_store.node_id}",key="{key}"}} {val}')
        summary = self.presence.summary()
        lines.append(f'backend_mesh_peer_count{{node_id="{self.state_store.node_id}"}} {summary["peer_count"]}')
        lines.append(f'backend_info{{node_id="{self.state_store.node_id}",swarm_id="{self.state_store.swarm_id}"}} 1')
        return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Runtime bundle
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class SwarmBackendRuntime:
    bridge: FoxMQBridge
    presence: MeshPresenceTracker
    router: SwarmCommandRouter

    def start(self) -> None:
        self.bridge.adapter.client.connect()
        self.bridge.start()

    def stop(self) -> None:
        self.bridge.stop()


def build_backend_runtime(
    swarm_id: str,
    node_id: str,
    broker_hosts: Sequence[str],
    *,
    broker_port: Optional[int] = None,
    persistence_dir: str | Path = ".foxmq",
    secret_key_path: Optional[str | Path] = None,
    stale_peer_s: int = 30,
    dead_peer_s: int = 90,
) -> SwarmBackendRuntime:
    bridge = make_foxmq_bridge(
        swarm_id,
        node_id,
        broker_hosts,
        persistence_dir=persistence_dir,
        secret_key_path=secret_key_path,
        port=broker_port,
    )
    presence = MeshPresenceTracker(bridge.adapter.state_store, stale_peer_s=stale_peer_s, dead_peer_s=dead_peer_s)
    router = SwarmCommandRouter(bridge)
    return SwarmBackendRuntime(bridge=bridge, presence=presence, router=router)


def build_repo_ready_runtime(
    swarm_id: str,
    node_id: str,
    broker_hosts: Sequence[str],
    *,
    broker_port: Optional[int] = None,
    persistence_dir: str | Path = ".foxmq",
    secret_key_path: Optional[str | Path] = None,
    stale_peer_s: int = 30,
    dead_peer_s: int = 90,
) -> SwarmBackendRuntime:
    """Alias for :func:`build_backend_runtime` (older notebooks / imports)."""
    return build_backend_runtime(
        swarm_id,
        node_id,
        broker_hosts,
        broker_port=broker_port,
        persistence_dir=persistence_dir,
        secret_key_path=secret_key_path,
        stale_peer_s=stale_peer_s,
        dead_peer_s=dead_peer_s,
    )


# ---------------------------------------------------------------------------
# Read model and event projection
# ---------------------------------------------------------------------------


class FleetViewCache:
    """A read-optimized cache for dashboards and API calls."""

    def __init__(
        self,
        state_store: SwarmStateStore,
        presence: MeshPresenceTracker,
        repository: MissionRepository,
        capacity: int = 2048,
    ) -> None:
        self.state_store = state_store
        self.presence = presence
        self.repository = repository
        self.capacity = capacity
        self._lock = threading.RLock()
        self._history: Deque[Dict[str, Any]] = deque(maxlen=capacity)
        self._last_snapshot: Dict[str, Any] = {}

    def snapshot(self) -> Dict[str, Any]:
        node = json.loads(self.state_store.snapshot().to_json())
        missions = [asdict(m) for m in self.repository.list()]
        missions_brief = [{"mission_id": m["mission_id"], "name": m.get("name", ""), "status": m.get("status", "")} for m in missions[:32]]
        with self._lock:
            hist_tail = list(self._history)[-25:]
        payload = {
            "node": node,
            "presence": self.presence.summary(),
            "missions": missions,
            "history_tail": hist_tail,
            "ts_ms": current_time_ms(),
            "tashi": mesh_tashi_projection(node, missions_brief=missions_brief, history_tail=hist_tail),
        }
        with self._lock:
            self._last_snapshot = payload
        return payload

    def append_event(self, event_type: str, payload: Dict[str, Any]) -> None:
        event = {"ts_ms": current_time_ms(), "event_type": event_type, "payload": payload}
        with self._lock:
            self._history.append(event)
            self._last_snapshot = {**self._last_snapshot, "last_event": event}

    def recent_events(self, limit: int = 100) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._history)[-limit:]


class FleetBroadcastHub:
    """Broadcasts state changes to websocket clients and FoxMQ subscribers."""

    def __init__(self, client: Any, view_cache: FleetViewCache) -> None:
        self.client = client
        self.view_cache = view_cache
        self._websockets: Set[Any] = set()
        self._lock = threading.RLock()

    async def attach(self, websocket: Any) -> None:
        async with self._ws_lock():
            self._websockets.add(websocket)

    async def detach(self, websocket: Any) -> None:
        async with self._ws_lock():
            self._websockets.discard(websocket)

    async def push(self, event_type: str, payload: Dict[str, Any]) -> None:
        message = json.dumps({"event_type": event_type, "payload": payload, "ts_ms": current_time_ms()}, sort_keys=True)
        dead: List[Any] = []
        async with self._ws_lock():
            for websocket in list(self._websockets):
                try:
                    await websocket.send_text(message)
                except Exception:
                    dead.append(websocket)
            for websocket in dead:
                self._websockets.discard(websocket)
        self.view_cache.append_event(event_type, payload)

    def publish_state(self) -> None:
        # Use mesh snapshots only — not the backend dashboard payload — so peers can merge state.
        self.client.publish_state_snapshot()

    def publish_alert(self, alert: Dict[str, Any]) -> None:
        self.client.publish(MessageKind.ALERT, FoxMQTopic.ALERT, alert, reliable=True)

    def publish_heartbeat(self) -> None:
        self.client.publish_heartbeat()

    def _ws_lock(self):
        class _Locker:
            def __init__(self, lock: threading.RLock) -> None:
                self.lock = lock

            async def __aenter__(self) -> None:
                self.lock.acquire()

            async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
                self.lock.release()

        return _Locker(self._lock)


# ---------------------------------------------------------------------------
# Scheduler and audit ledger
# ---------------------------------------------------------------------------


class FleetScheduler:
    """Schedules periodic backend jobs like sync, garbage collection, and alerts."""

    def __init__(
        self,
        repository: MissionRepository,
        view_cache: FleetViewCache,
        hub: FleetBroadcastHub,
        state_store: SwarmStateStore,
        presence: MeshPresenceTracker,
        metric_store: JSONFileStore,
    ) -> None:
        self.repository = repository
        self.view_cache = view_cache
        self.hub = hub
        self.state_store = state_store
        self.presence = presence
        self._metric_store = metric_store
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._last_metrics_save_ms = 0

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._loop, name="backend-scheduler", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=1.0)

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self._tick()
            except Exception:
                LOG.exception("backend scheduler tick failed")
            if self._stop.wait(1.0):
                break

    def _tick(self) -> None:
        sweep = self.presence.sweep()
        if sweep["stale"]:
            self.view_cache.append_event("presence_stale", {"nodes": sweep["stale"]})
        if sweep["dead"]:
            self.view_cache.append_event("presence_dead", {"nodes": sweep["dead"]})
        self._reconcile_missions()
        self._refresh_metric_snapshot()

    def _reconcile_missions(self) -> None:
        for mission in self.repository.list():
            if mission.status == "running" and not mission.active_nodes:
                mission.status = "degraded"
                mission.touch()
                self.repository.upsert(mission)
                self.hub.publish_alert({"type": "mission_degraded", "mission_id": mission.mission_id, "reason": "no_active_nodes"})

    def _refresh_metric_snapshot(self) -> None:
        now = current_time_ms()
        if now - self._last_metrics_save_ms < 5000:
            return
        self._last_metrics_save_ms = now
        missions = self.repository.list()
        metrics = {
            "state": self.state_store.get_metrics(),
            "presence": self.presence.summary(),
            "missions": {
                "total": len(missions),
                "running": sum(1 for m in missions if m.status == "running"),
                "draft": sum(1 for m in missions if m.status == "draft"),
            },
            "ts_ms": now,
        }
        self._metric_store.save({"metrics": metrics, "ts_ms": now})


class SwarmEventLedger:
    """Append-only event ledger for auditability."""

    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()

    def append(self, event_type: str, payload: Dict[str, Any]) -> None:
        record = {"ts_ms": current_time_ms(), "event_type": event_type, "payload": payload}
        with self._lock:
            with self.path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(record, sort_keys=True) + "\n")

    def tail(self, limit: int = 100) -> List[Dict[str, Any]]:
        if not self.path.exists():
            return []
        max_chunk = 256 * 1024
        with self.path.open("rb") as fh:
            fh.seek(0, 2)
            size = fh.tell()
            buf = b""
            pos = size
            while pos > 0 and buf.count(b"\n") <= limit:
                step = min(max_chunk, pos)
                pos -= step
                fh.seek(pos)
                buf = fh.read(step) + buf
            lines = buf.splitlines()[-limit:]
        result: List[Dict[str, Any]] = []
        for raw in lines:
            try:
                result.append(json.loads(raw.decode("utf-8")))
            except Exception:
                continue
        return result


# ---------------------------------------------------------------------------
# Backend service
# ---------------------------------------------------------------------------


class ServiceError(RuntimeError):
    pass


class MissingDependencyError(ServiceError):
    pass


class SwarmBackendService:
    """Backend service that sits on top of the FoxMQ runtime."""

    def __init__(self, runtime: SwarmBackendRuntime, settings: Optional[BackendSettings] = None) -> None:
        self.runtime = runtime
        self.settings = settings or BackendSettings()
        self.store = JSONFileStore(self.settings.mission_state_path)
        self.repository = MissionRepository(self.store)
        self.presence = runtime.presence
        self._metric_store = JSONFileStore(self.settings.metric_snapshot_path)
        self.view_cache = FleetViewCache(
            runtime.bridge.adapter.state_store,
            self.presence,
            self.repository,
            capacity=self.settings.max_history,
        )
        self.hub = FleetBroadcastHub(runtime.bridge.adapter.client, self.view_cache)
        self.ledger = SwarmEventLedger(self.settings.event_log_path)
        self.scheduler = FleetScheduler(
            self.repository,
            self.view_cache,
            self.hub,
            runtime.bridge.adapter.state_store,
            self.presence,
            self._metric_store,
        )
        self.router = runtime.router
        self._app: Optional[Any] = None
        self._server_thread: Optional[threading.Thread] = None
        self._ws_clients: Set[Any] = set()
        self._lock = threading.RLock()

    @property
    def app(self) -> Any:
        if self._app is None:
            self._app = self._build_app()
        return self._app

    def start(self) -> None:
        self.runtime.start()
        self.scheduler.start()
        self.ledger.append("backend_start", {"node_id": self.runtime.bridge.adapter.state_store.node_id})
        if uvicorn is None:
            return
        if self._server_thread is not None:
            return
        self._server_thread = threading.Thread(target=self._serve, name="backend-http", daemon=True)
        self._server_thread.start()

    def stop(self) -> None:
        self.ledger.append("backend_stop", {"node_id": self.runtime.bridge.adapter.state_store.node_id})
        self.scheduler.stop()
        self.runtime.stop()
        if self._server_thread is not None:
            self._server_thread.join(timeout=1.0)

    def _build_app(self) -> Any:
        if FastAPI is Any:
            raise MissingDependencyError("fastapi is required to build the backend API")
        app = FastAPI(title="Vertex Swarm Backend", version="2.0.0")
        app.add_middleware(
            CORSMiddleware,
            allow_origins=self.settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        backend = self

        @app.get("/health")
        def health() -> Dict[str, Any]:
            return backend.health_report()

        @app.get("/metrics")
        def metrics() -> PlainTextResponse:
            return PlainTextResponse(backend.metrics_text(), media_type="text/plain")

        @app.get("/snapshot")
        def snapshot() -> Dict[str, Any]:
            return backend.snapshot()

        @app.get("/missions")
        def list_missions() -> Dict[str, Any]:
            return {"missions": [asdict(m) for m in backend.repository.list()]}

        @app.post("/missions")
        def create_mission(payload: Dict[str, Any]) -> Dict[str, Any]:
            mission = backend.create_mission_from_payload(payload)
            return asdict(mission)

        @app.get("/missions/{mission_id}")
        def get_mission(mission_id: str) -> Dict[str, Any]:
            mission = backend.repository.get(mission_id)
            if mission is None:
                raise HTTPException(status_code=404, detail="mission not found")
            return asdict(mission)

        @app.patch("/missions/{mission_id}")
        def patch_mission(mission_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
            try:
                mission = backend.update_mission(mission_id, payload)
            except KeyError:
                raise HTTPException(status_code=404, detail="mission not found")
            return asdict(mission)

        @app.delete("/missions/{mission_id}")
        def delete_mission(mission_id: str) -> Dict[str, Any]:
            ok = backend.repository.delete(mission_id)
            backend.ledger.append("mission_deleted", {"mission_id": mission_id, "ok": ok})
            if not ok:
                raise HTTPException(status_code=404, detail="mission not found")
            return {"ok": True}

        @app.post("/missions/{mission_id}/start")
        def start_mission(mission_id: str) -> Dict[str, Any]:
            try:
                mission = backend.repository.update_status(mission_id, "running")
            except KeyError:
                raise HTTPException(status_code=404, detail="mission not found")
            backend.publish_mission_event("mission_started", asdict(mission))
            return asdict(mission)

        @app.post("/missions/{mission_id}/stop")
        def stop_mission(mission_id: str) -> Dict[str, Any]:
            try:
                mission = backend.repository.update_status(mission_id, "completed")
            except KeyError:
                raise HTTPException(status_code=404, detail="mission not found")
            backend.publish_mission_event("mission_completed", asdict(mission))
            return asdict(mission)

        @app.get("/ledger")
        def ledger(limit: int = 100) -> Dict[str, Any]:
            return {"events": backend.ledger.tail(limit)}

        @app.get("/roles")
        def roles() -> Dict[str, Any]:
            return {"roles": backend.current_roles()}

        @app.post("/roles")
        def set_roles(payload: Dict[str, Any]) -> Dict[str, Any]:
            mission_id = str(payload.get("mission_id", ""))
            roles = dict(payload.get("roles", {}))
            if not mission_id:
                raise HTTPException(status_code=400, detail="mission_id required")
            try:
                mission = backend.repository.update_roles(mission_id, roles)
            except KeyError:
                raise HTTPException(status_code=404, detail="mission not found")
            backend.publish_mission_event("roles_updated", asdict(mission))
            return asdict(mission)

        @app.post("/tasks")
        def create_task(payload: Dict[str, Any]) -> Dict[str, Any]:
            mission_id = str(payload.get("mission_id", ""))
            task_id = str(payload.get("task_id", f"task-{random.getrandbits(32):08x}"))
            if not mission_id:
                raise HTTPException(status_code=400, detail="mission_id required")
            try:
                mission = backend.repository.add_task(mission_id, task_id, payload)
            except KeyError:
                raise HTTPException(status_code=404, detail="mission not found")
            backend.publish_mission_event("task_created", {"mission_id": mission_id, "task_id": task_id, "payload": payload})
            return asdict(mission)

        @app.post("/alerts")
        def raise_alert(payload: Dict[str, Any]) -> Dict[str, Any]:
            mission_id = str(payload.get("mission_id", ""))
            if not mission_id:
                raise HTTPException(status_code=400, detail="mission_id required")
            try:
                mission = backend.repository.add_alert(mission_id, payload)
            except KeyError:
                raise HTTPException(status_code=404, detail="mission not found")
            backend.publish_alert_event(payload)
            return asdict(mission)

        @app.post("/command")
        def command(payload: Dict[str, Any]) -> Dict[str, Any]:
            target_id = str(payload.get("target_id", ""))
            command_name = str(payload.get("command", ""))
            args = dict(payload.get("args", {}))
            if not target_id or not command_name:
                raise HTTPException(status_code=400, detail="target_id and command required")
            try:
                cmd = RemoteCommand(command_name)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"unsupported command: {command_name}")
            try:
                response = backend.send_remote_command(target_id, cmd, args, wait=bool(payload.get("wait", True)))
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))
            except Exception as exc:
                raise HTTPException(status_code=500, detail=str(exc))
            return public_command_result(response)

        @app.get("/snapshot/recent")
        def recent(limit: int = 100) -> Dict[str, Any]:
            return {"events": backend.view_cache.recent_events(limit)}

        if self.settings.enable_websocket:

            @app.websocket("/ws")
            async def websocket_endpoint(ws: WebSocket) -> None:
                await ws.accept()
                await backend.attach_websocket(ws)
                try:
                    await ws.send_text(json.dumps({"type": "snapshot", "payload": backend.snapshot()}, sort_keys=True))
                    while True:
                        raw = await ws.receive_text()
                        await backend.handle_ws_message(ws, raw)
                except WebSocketDisconnect:
                    pass
                except Exception:
                    LOG.exception("websocket error")
                finally:
                    await backend.detach_websocket(ws)

        return app

    def _serve(self) -> None:
        if uvicorn is None:
            raise MissingDependencyError("uvicorn is required to run the backend server")
        uvicorn.run(self.app, host=self.settings.host, port=self.settings.port, log_level="info")

    def health_report(self) -> Dict[str, Any]:
        snapshot = self.runtime.bridge.adapter.health_summary()
        presence = self.presence.summary()
        missions = self.repository.list()
        node = json.loads(self.runtime.bridge.adapter.state_store.snapshot().to_json())
        missions_brief = [{"mission_id": m.mission_id, "name": m.name, "status": m.status} for m in missions[:32]]
        return {
            "status": "ok",
            "node": snapshot,
            "presence": presence,
            "mission_count": len(missions),
            "mission_status_counts": self._mission_status_counts(),
            "ts_ms": current_time_ms(),
            "tashi": mesh_tashi_projection(node, missions_brief=missions_brief),
        }

    def metrics_text(self) -> str:
        exporter = PrometheusTextExporter(self.runtime.bridge.adapter.state_store, self.presence)
        return exporter.render()

    def snapshot(self) -> Dict[str, Any]:
        return self.view_cache.snapshot()

    def current_roles(self) -> Dict[str, str]:
        snap = self.runtime.bridge.adapter.state_store.snapshot()
        roles: Dict[str, str] = {snap.node_id: snap.role}
        for peer_id, peer in snap.peers.items():
            roles[peer_id] = str(peer.get("role", "standby"))
        return dict(sorted(roles.items()))

    def _mission_status_counts(self) -> Dict[str, int]:
        counts: DefaultDict[str, int] = defaultdict(int)
        for mission in self.repository.list():
            counts[mission.status] += 1
        return dict(counts)

    def create_mission_from_payload(self, payload: Dict[str, Any]) -> MissionState:
        name = str(payload.get("name", "untitled"))
        description = str(payload.get("description", ""))
        target_count = int(payload.get("target_count", 0))
        mission_id = payload.get("mission_id")
        mission = self.repository.create(
            name,
            description,
            mission_id=str(mission_id) if mission_id is not None else None,
            target_count=target_count,
            metadata=dict(payload.get("metadata", {})),
        )
        self.publish_mission_event("mission_created", asdict(mission))
        return mission

    def update_mission(self, mission_id: str, payload: Dict[str, Any]) -> MissionState:
        mission = self.repository.get(mission_id)
        if mission is None:
            raise KeyError(mission_id)
        if "name" in payload:
            mission.name = str(payload["name"])
        if "description" in payload:
            mission.description = str(payload["description"])
        if "target_count" in payload:
            mission.target_count = int(payload["target_count"])
        if "status" in payload:
            mission.status = str(payload["status"])
        if "metadata" in payload:
            mission.metadata.update(dict(payload["metadata"]))
        if "active_nodes" in payload:
            mission.active_nodes = list(payload["active_nodes"])
        if "roles" in payload:
            mission.roles = dict(payload["roles"])
        mission.touch()
        self.repository.upsert(mission)
        self.publish_mission_event("mission_updated", asdict(mission))
        return mission

    def publish_mission_event(self, event_type: str, payload: Dict[str, Any]) -> None:
        self.ledger.append(event_type, payload)
        self.view_cache.append_event(event_type, payload)
        self.runtime.bridge.adapter.client.publish(
            MessageKind.CUSTOM,
            FoxMQTopic.STATE,
            {"event_type": event_type, "payload": payload},
            reliable=True,
        )

    def publish_alert_event(self, payload: Dict[str, Any]) -> None:
        self.ledger.append("alert", payload)
        self.view_cache.append_event("alert", payload)
        self.runtime.bridge.adapter.client.publish(MessageKind.ALERT, FoxMQTopic.ALERT, payload, reliable=True)

    def send_remote_command(
        self,
        target_id: str,
        command: RemoteCommand,
        args: Dict[str, Any],
        *,
        wait: bool = True,
    ) -> Optional[CommandResponse]:
        response = self.runtime.router.send(target_id, command, args, wait=wait)
        self.ledger.append(
            "remote_command",
            {
                "target_id": target_id,
                "command": command.value,
                "args": args,
                "response": asdict(response) if response else None,
            },
        )
        return response

    async def attach_websocket(self, ws: Any) -> None:
        with self._lock:
            self._ws_clients.add(ws)
        await self.hub.attach(ws)

    async def detach_websocket(self, ws: Any) -> None:
        with self._lock:
            self._ws_clients.discard(ws)
        await self.hub.detach(ws)

    async def handle_ws_message(self, ws: Any, raw: str) -> None:
        try:
            payload = json.loads(raw)
        except Exception:
            await ws.send_text(json.dumps({"type": "error", "error": "invalid_json"}))
            return

        msg_type = str(payload.get("type", ""))
        if msg_type == "ping":
            await ws.send_text(json.dumps({"type": "pong", "ts_ms": current_time_ms()}))
        elif msg_type == "snapshot":
            await ws.send_text(json.dumps({"type": "snapshot", "payload": self.snapshot()}, sort_keys=True))
        elif msg_type == "command":
            result = self.handle_ws_command(payload)
            await ws.send_text(json.dumps({"type": "command_result", "payload": result}, sort_keys=True))
        elif msg_type == "mission":
            result = self.handle_ws_mission(payload)
            await ws.send_text(json.dumps({"type": "mission_result", "payload": result}, sort_keys=True))
        elif msg_type == "broadcast":
            await self.hub.push("broadcast", payload.get("payload", {}))
        else:
            await ws.send_text(json.dumps({"type": "error", "error": f"unknown_message_type:{msg_type}"}))

    def handle_ws_command(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        target_id = str(payload.get("target_id", ""))
        command_name = str(payload.get("command", ""))
        args = dict(payload.get("args", {}))
        try:
            cmd = RemoteCommand(command_name)
        except ValueError as exc:
            return {"ok": False, "result": {}, "error": str(exc), "async": False, "response": None}
        try:
            response = self.send_remote_command(target_id, cmd, args, wait=True)
        except Exception as exc:
            return {"ok": False, "result": {}, "error": str(exc), "async": False, "response": None}
        return public_command_result(response)

    def handle_ws_mission(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        action = str(payload.get("action", ""))
        mission_payload = dict(payload.get("mission", {}))
        try:
            if action == "create":
                mission = self.create_mission_from_payload(mission_payload)
                return asdict(mission)
            if action == "update":
                mission_id = str(mission_payload.get("mission_id", ""))
                return asdict(self.update_mission(mission_id, mission_payload))
            if action == "start":
                mission_id = str(mission_payload.get("mission_id", ""))
                mission = self.repository.update_status(mission_id, "running")
                self.publish_mission_event("mission_started", asdict(mission))
                return asdict(mission)
            if action == "stop":
                mission_id = str(mission_payload.get("mission_id", ""))
                mission = self.repository.update_status(mission_id, "completed")
                self.publish_mission_event("mission_completed", asdict(mission))
                return asdict(mission)
        except KeyError:
            return {"error": "mission_not_found"}
        raise ValueError(f"unknown mission action: {action}")


# ---------------------------------------------------------------------------
# Bootstrap helpers
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class BackendRuntimeBundle:
    settings: BackendSettings
    runtime: SwarmBackendRuntime
    service: SwarmBackendService

    def start(self) -> None:
        self.service.start()

    def stop(self) -> None:
        self.service.stop()

    def health(self) -> Dict[str, Any]:
        return self.service.health_report()

    def snapshot(self) -> Dict[str, Any]:
        return self.service.snapshot()


def build_backend_bundle(
    swarm_id: str,
    node_id: str,
    broker_hosts: Sequence[str],
    *,
    backend_port: int = 8080,
    data_dir: str | Path = ".backend",
    foxmq_persistence_dir: str | Path = ".foxmq",
    broker_port: Optional[int] = None,
    secret_key_path: Optional[str | Path] = None,
) -> BackendRuntimeBundle:
    settings = BackendSettings(
        port=backend_port,
        data_dir=Path(data_dir),
        mission_state_path=Path(data_dir) / "mission_state.json",
        event_log_path=Path(data_dir) / "backend.events.jsonl",
        metric_snapshot_path=Path(data_dir) / "metrics.json",
    )
    runtime = build_backend_runtime(
        swarm_id,
        node_id,
        broker_hosts,
        broker_port=broker_port,
        persistence_dir=foxmq_persistence_dir,
        secret_key_path=secret_key_path,
        stale_peer_s=settings.stale_peer_s,
        dead_peer_s=settings.dead_peer_s,
    )
    service = SwarmBackendService(runtime, settings)
    return BackendRuntimeBundle(settings=settings, runtime=runtime, service=service)


def backend_smoke_demo() -> Dict[str, Any]:
    bundle = build_backend_bundle("backend-demo", "backend-node", ["127.0.0.1"])
    bundle.start()
    try:
        mission = bundle.service.create_mission_from_payload(
            {
                "name": "Search Grid A",
                "description": "Demo mission for the Vertex hackathon backend",
                "target_count": 5,
                "metadata": {"mode": "blackout"},
            }
        )
        bundle.service.update_mission(mission.mission_id, {"status": "running"})
        bundle.service.repository.add_task(mission.mission_id, "task-1", {"type": "sector_scan", "priority": 10})
        bundle.service.repository.add_alert(mission.mission_id, {"type": "note", "message": "backend smoke demo"})
        node_id = bundle.runtime.bridge.adapter.state_store.node_id
        bundle.service.send_remote_command(node_id, RemoteCommand.GET_HEALTH, {}, wait=True)
        report = {
            "health": bundle.health(),
            "snapshot": bundle.snapshot(),
            "metrics": bundle.service.metrics_text(),
        }
    finally:
        bundle.stop()
    return report


if __name__ == "__main__":  # pragma: no cover
    logging.basicConfig(level=logging.INFO)
    print(json.dumps(backend_smoke_demo(), indent=2, sort_keys=True))
