"""FoxMQ (MQTT) coordination layer for the decentralized swarm runtime.

Strongly-typed topics under ``swarm/{swarm_id}/mesh/...``, JSON envelopes with
IDs and optional HMAC signatures, dedupe, optional reliable publish tracking,
local LWW state, heartbeats, and adapters for ``chain_manager`` / ``target_manager``.

Requires ``paho-mqtt`` for live brokers; :class:`MockFoxMQClient` supports tests
without a broker. Paho v2.x is supported via :func:`_create_mqtt_client`.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import queue
import random
import threading
import time
from collections import OrderedDict, defaultdict, deque
from dataclasses import asdict, dataclass, field, fields
from enum import Enum
from pathlib import Path
from typing import (
    Any,
    Callable,
    DefaultDict,
    Deque,
    Dict,
    List,
    Optional,
    Protocol,
    Sequence,
    Set,
    Tuple,
)

try:  # pragma: no cover - optional dependency
    import paho.mqtt.client as mqtt
except Exception:  # pragma: no cover - optional dependency
    mqtt = None  # type: ignore[assignment]

from swarm import config as swarm_config

LOG = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Topic model — all MQTT paths are swarm-scoped
# ---------------------------------------------------------------------------


class FoxMQTopic(str, Enum):
    HELLO = "mesh/hello"
    HEARTBEAT = "mesh/heartbeat"
    STATE = "mesh/state"
    STATE_REQUEST = "mesh/state/request"
    STATE_RESPONSE = "mesh/state/response"
    ROLE = "mesh/role"
    TASK = "mesh/task"
    TASK_BID = "mesh/task/bid"
    TASK_COMMIT = "mesh/task/commit"
    ALERT = "mesh/alert"
    SAFETY = "mesh/safety"
    METRICS = "mesh/metrics"
    ACK = "mesh/ack"
    PING = "mesh/ping"
    GOSSIP = "mesh/gossip"


class MessageKind(str, Enum):
    HELLO = "hello"
    HEARTBEAT = "heartbeat"
    STATE = "state"
    STATE_REQUEST = "state_request"
    STATE_RESPONSE = "state_response"
    ROLE = "role"
    TASK = "task"
    TASK_BID = "task_bid"
    TASK_COMMIT = "task_commit"
    ALERT = "alert"
    SAFETY = "safety"
    ACK = "ack"
    PING = "ping"
    GOSSIP = "gossip"
    CUSTOM = "custom"


def swarm_topic(swarm_id: str, rel: FoxMQTopic | str) -> str:
    """Canonical MQTT topic: ``swarm/{swarm_id}/{mesh/...}``."""
    rel_s = rel.value if isinstance(rel, FoxMQTopic) else str(rel).lstrip("/")
    return f"swarm/{swarm_id}/{rel_s}"


def _mqtt_success(rc: Any) -> bool:
    try:
        return int(getattr(rc, "value", rc)) == 0
    except (TypeError, ValueError):
        return rc == 0


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class FoxMQConfig:
    swarm_id: str
    node_id: str
    broker_hosts: List[str]
    broker_port: int = 19793
    client_id: Optional[str] = None
    qos: int = 2
    keepalive: int = 30
    connect_timeout_s: float = 15.0
    reconnect_min_backoff_s: float = 0.5
    reconnect_max_backoff_s: float = 8.0
    publish_retry_limit: int = 5
    publish_ack_timeout_s: float = 1.5
    state_sync_interval_s: float = 10.0
    heartbeat_interval_s: float = 2.0
    heartbeat_timeout_s: float = 7.5
    dedupe_ttl_s: float = 45.0
    max_recent_message_ids: int = 4096
    persistence_dir: Path = Path(".foxmq")
    secret_key_path: Optional[Path] = None
    username: Optional[str] = None
    password: Optional[str] = None
    use_tls: bool = False
    tls_ca_path: Optional[Path] = None
    tls_cert_path: Optional[Path] = None
    tls_key_path: Optional[Path] = None
    extra_headers: Dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.client_id is None:
            self.client_id = f"{self.swarm_id}-{self.node_id}-{os.getpid()}"
        self.persistence_dir = Path(self.persistence_dir)
        self.persistence_dir.mkdir(parents=True, exist_ok=True)

    @property
    def local_state_path(self) -> Path:
        return self.persistence_dir / f"{self.swarm_id}.{self.node_id}.json"

    def validate(self) -> None:
        if not self.swarm_id:
            raise ValueError("swarm_id is required")
        if not self.node_id:
            raise ValueError("node_id is required")
        if not self.broker_hosts:
            raise ValueError("broker_hosts cannot be empty")
        if self.qos not in (0, 1, 2):
            raise ValueError("qos must be 0, 1, or 2")
        if self.secret_key_path is not None and not Path(self.secret_key_path).exists():
            LOG.warning("secret key path does not exist yet: %s", self.secret_key_path)

    def topic(self, rel: FoxMQTopic | str) -> str:
        return swarm_topic(self.swarm_id, rel)


@dataclass(slots=True)
class AddressBookEntry:
    host: str
    port: int
    node_name: str
    secret_key_path: Optional[str] = None


@dataclass(slots=True)
class FoxMQClusterSpec:
    swarm_id: str
    entries: List[AddressBookEntry]

    def to_json(self) -> str:
        return json.dumps(
            {"swarm_id": self.swarm_id, "entries": [asdict(e) for e in self.entries]},
            indent=2,
            sort_keys=True,
        )


def foxmq_config_from_swarm_config(
    swarm_id: str,
    node_id: str,
    *,
    broker_hosts: Optional[Sequence[str]] = None,
    broker_port: Optional[int] = None,
    persistence_dir: str | Path = ".foxmq",
    secret_key_path: Optional[str | Path] = None,
    qos: int = 2,
) -> FoxMQConfig:
    """Build :class:`FoxMQConfig` using defaults from :mod:`swarm.config` when omitted."""
    hosts = list(broker_hosts) if broker_hosts is not None else [swarm_config.FOXMQ_HOST]
    port = int(broker_port if broker_port is not None else getattr(swarm_config, "FOXMQ_MQTT_PORT", swarm_config.FOXMQ_PORT))
    return FoxMQConfig(
        swarm_id=swarm_id,
        node_id=node_id,
        broker_hosts=hosts,
        broker_port=port,
        persistence_dir=Path(persistence_dir),
        secret_key_path=Path(secret_key_path) if secret_key_path else None,
        qos=qos,
    )


# ---------------------------------------------------------------------------
# Envelope and state
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class MeshEnvelope:
    kind: MessageKind
    swarm_id: str
    sender_id: str
    topic: str
    message_id: str
    timestamp_ms: int
    seq: int
    payload: Dict[str, Any]
    ttl: int = 4
    reply_to: Optional[str] = None
    correlation_id: Optional[str] = None
    trace_id: Optional[str] = None
    causal_version: int = 0
    signature: Optional[str] = None

    def to_json(self) -> str:
        d = asdict(self)
        d["kind"] = self.kind.value
        return json.dumps(d, separators=(",", ":"), sort_keys=True)

    def canonical_bytes_for_signing(self) -> bytes:
        d = asdict(self)
        d.pop("signature", None)
        d["kind"] = self.kind.value
        return json.dumps(d, separators=(",", ":"), sort_keys=True).encode("utf-8")

    @classmethod
    def from_json(cls, raw: str) -> MeshEnvelope:
        data = json.loads(raw)
        data["kind"] = MessageKind(data["kind"])
        return cls(**{f.name: data[f.name] for f in fields(cls) if f.name in data})


@dataclass(slots=True)
class PeerRecord:
    node_id: str
    last_seen_ms: int
    role: str = "standby"
    status: str = "ready"
    depth: int = 0
    battery: float = 1.0
    latency_ms: float = 0.0
    loss_rate: float = 0.0
    version: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def touch(self, *, now_ms: Optional[int] = None, **updates: Any) -> None:
        self.last_seen_ms = now_ms or current_time_ms()
        for key, value in updates.items():
            if hasattr(self, key):
                setattr(self, key, value)
            else:
                self.metadata[key] = value


@dataclass(slots=True)
class LWWValue:
    value: Any
    version: int
    updated_at_ms: int
    source_id: str


@dataclass(slots=True)
class MeshStateSnapshot:
    node_id: str
    swarm_id: str
    role: str
    status: str
    depth: int
    version: int
    peers: Dict[str, Dict[str, Any]]
    registers: Dict[str, Dict[str, Any]]
    tasks: Dict[str, Dict[str, Any]]
    alerts: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    updated_at_ms: int

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> MeshStateSnapshot:
        names = {f.name for f in fields(cls)}
        return cls(**{k: data[k] for k in names if k in data})


def current_time_ms() -> int:
    return int(time.time() * 1000)


class MessageIdGenerator:
    def __init__(self, node_id: str) -> None:
        self._node_id = node_id
        self._lock = threading.Lock()
        self._seq = 0

    def next(self, prefix: str = "msg") -> Tuple[str, int]:
        with self._lock:
            self._seq += 1
            seq = self._seq
        msg_id = f"{self._node_id}:{prefix}:{seq}:{random.getrandbits(32):08x}"
        return msg_id, seq


class ExponentialBackoff:
    def __init__(self, initial_s: float = 0.5, maximum_s: float = 8.0, factor: float = 1.8) -> None:
        self.initial_s = initial_s
        self.maximum_s = maximum_s
        self.factor = factor
        self._current = initial_s

    def reset(self) -> None:
        self._current = self.initial_s

    def next_delay(self) -> float:
        delay = self._current
        self._current = min(self.maximum_s, self._current * self.factor)
        return delay


class DedupeCache:
    """Recent message IDs (and optional payload fingerprints)."""

    def __init__(self, ttl_s: float = 45.0, max_items: int = 4096) -> None:
        self.ttl_s = ttl_s
        self.max_items = max_items
        self._items: OrderedDict[str, float] = OrderedDict()
        self._lock = threading.Lock()

    def seen(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            self._purge_locked(now)
            if key in self._items:
                return True
            self._items[key] = now
            self._items.move_to_end(key)
            while len(self._items) > self.max_items:
                self._items.popitem(last=False)
            return False

    def _purge_locked(self, now: float) -> None:
        ttl = self.ttl_s
        stale = [k for k, ts in self._items.items() if now - ts > ttl]
        for k in stale:
            self._items.pop(k, None)


class EventBus:
    def __init__(self) -> None:
        self._handlers: DefaultDict[str, List[Callable[[Dict[str, Any]], None]]] = defaultdict(list)
        self._lock = threading.RLock()

    def on(self, event: str, handler: Callable[[Dict[str, Any]], None]) -> None:
        with self._lock:
            self._handlers[event].append(handler)

    def emit(self, event: str, payload: Dict[str, Any]) -> None:
        with self._lock:
            handlers = list(self._handlers.get(event, ()))
        for handler in handlers:
            try:
                handler(payload)
            except Exception:
                LOG.exception("event handler failed for %s", event)


# ---------------------------------------------------------------------------
# Persistence + store
# ---------------------------------------------------------------------------


class StatePersistence:
    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def save(self, data: Dict[str, Any]) -> None:
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
        tmp.replace(self.path)

    def load(self) -> Dict[str, Any]:
        if not self.path.exists():
            return {}
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            LOG.exception("could not load persisted state from %s", self.path)
            return {}


class SwarmStateStore:
    def __init__(self, node_id: str, swarm_id: str, persistence: StatePersistence) -> None:
        self.node_id = node_id
        self.swarm_id = swarm_id
        self.persistence = persistence
        self._lock = threading.RLock()
        self._version = 0
        self._role = "standby"
        self._status = "ready"
        self._depth = 0
        self._peers: Dict[str, PeerRecord] = {}
        self._registers: Dict[str, LWWValue] = {}
        self._tasks: Dict[str, Dict[str, Any]] = {}
        self._alerts: Deque[Dict[str, Any]] = deque(maxlen=256)
        self._metrics: Dict[str, Any] = {
            "messages_sent": 0,
            "messages_received": 0,
            "acks_received": 0,
            "retries": 0,
            "syncs": 0,
            "state_merges": 0,
            "peer_timeouts": 0,
            "last_sync_ms": 0,
        }
        self._load_persisted_state()

    @property
    def version(self) -> int:
        with self._lock:
            return self._version

    @property
    def role(self) -> str:
        with self._lock:
            return self._role

    @property
    def status(self) -> str:
        with self._lock:
            return self._status

    @property
    def depth(self) -> int:
        with self._lock:
            return self._depth

    def _load_persisted_state(self) -> None:
        data = self.persistence.load()
        if not data:
            return
        with self._lock:
            self._version = int(data.get("version", 0))
            self._role = data.get("role", self._role)
            self._status = data.get("status", self._status)
            self._depth = int(data.get("depth", self._depth))
            for peer_id, peer_data in data.get("peers", {}).items():
                pdata = {f.name: peer_data[f.name] for f in fields(PeerRecord) if f.name in peer_data}
                self._peers[peer_id] = PeerRecord(node_id=peer_id, **pdata)
            for key, value in data.get("registers", {}).items():
                vdata = {f.name: value[f.name] for f in fields(LWWValue) if f.name in value}
                self._registers[key] = LWWValue(**vdata)
            self._tasks = data.get("tasks", {})
            self._alerts.extend(data.get("alerts", []))
            self._metrics.update(data.get("metrics", {}))

    def persist(self) -> None:
        with self._lock:
            payload = {
                "node_id": self.node_id,
                "swarm_id": self.swarm_id,
                "version": self._version,
                "role": self._role,
                "status": self._status,
                "depth": self._depth,
                "peers": {pid: asdict(p) for pid, p in self._peers.items()},
                "registers": {k: asdict(v) for k, v in self._registers.items()},
                "tasks": self._tasks,
                "alerts": list(self._alerts),
                "metrics": self._metrics,
                "saved_at_ms": current_time_ms(),
            }
        self.persistence.save(payload)

    def snapshot(self) -> MeshStateSnapshot:
        with self._lock:
            return MeshStateSnapshot(
                node_id=self.node_id,
                swarm_id=self.swarm_id,
                role=self._role,
                status=self._status,
                depth=self._depth,
                version=self._version,
                peers={pid: asdict(p) for pid, p in self._peers.items()},
                registers={k: asdict(v) for k, v in self._registers.items()},
                tasks=self._tasks.copy(),
                alerts=list(self._alerts),
                metrics=self._metrics.copy(),
                updated_at_ms=current_time_ms(),
            )

    def _bump_version_locked(self) -> int:
        self._version += 1
        return self._version

    def set_role(self, role: str) -> int:
        with self._lock:
            if self._role == role:
                return self._version
            self._role = role
            v = self._bump_version_locked()
        self.persist()
        return v

    def set_status(self, status: str) -> int:
        with self._lock:
            if self._status == status:
                return self._version
            self._status = status
            v = self._bump_version_locked()
        self.persist()
        return v

    def set_depth(self, depth: int) -> int:
        with self._lock:
            if self._depth == depth:
                return self._version
            self._depth = depth
            v = self._bump_version_locked()
        self.persist()
        return v

    def update_register(self, key: str, value: Any, *, source_id: Optional[str] = None, version: Optional[int] = None) -> int:
        source_id = source_id or self.node_id
        with self._lock:
            current = self._registers.get(key)
            next_version = version if version is not None else (current.version + 1 if current else 1)
            if current and next_version < current.version:
                return current.version
            self._registers[key] = LWWValue(
                value=value,
                version=next_version,
                updated_at_ms=current_time_ms(),
                source_id=source_id,
            )
            v = self._bump_version_locked()
        self.persist()
        return v

    def merge_register(self, key: str, incoming: LWWValue) -> bool:
        with self._lock:
            current = self._registers.get(key)
            if current and current.version > incoming.version:
                return False
            if current and current.version == incoming.version and current.updated_at_ms >= incoming.updated_at_ms:
                return False
            self._registers[key] = incoming
            self._bump_version_locked()
        self.persist()
        return True

    def add_peer(self, peer: PeerRecord) -> bool:
        with self._lock:
            current = self._peers.get(peer.node_id)
            if current is None or peer.last_seen_ms >= current.last_seen_ms:
                self._peers[peer.node_id] = peer
                self._bump_version_locked()
                changed = True
            else:
                changed = False
        if changed:
            self.persist()
        return changed

    def touch_peer(self, peer_id: str, **updates: Any) -> None:
        with self._lock:
            peer = self._peers.get(peer_id)
            if peer is None:
                peer = PeerRecord(node_id=peer_id, last_seen_ms=current_time_ms())
                self._peers[peer_id] = peer
            peer.touch(**updates)
            self._bump_version_locked()
        self.persist()

    def remove_peer(self, peer_id: str) -> bool:
        with self._lock:
            removed = self._peers.pop(peer_id, None) is not None
            if removed:
                self._bump_version_locked()
        if removed:
            self.persist()
        return removed

    def record_alert(self, alert: Dict[str, Any]) -> None:
        with self._lock:
            self._alerts.append(alert)
            self._bump_version_locked()
        self.persist()

    def upsert_task(self, task_id: str, payload: Dict[str, Any]) -> None:
        with self._lock:
            self._tasks[task_id] = payload
            self._bump_version_locked()
        self.persist()

    def get_task_payload(self, task_id: str) -> Dict[str, Any]:
        with self._lock:
            return dict(self._tasks.get(task_id, {}))

    def merge_snapshot(self, snapshot: MeshStateSnapshot) -> Dict[str, int]:
        changes = {"peers": 0, "registers": 0, "tasks": 0, "alerts": 0}
        with self._lock:
            if snapshot.version > self._version:
                self._version = snapshot.version
            if snapshot.role != self._role:
                self._role = snapshot.role
                changes["registers"] += 1
            if snapshot.status != self._status:
                self._status = snapshot.status
                changes["registers"] += 1
            if snapshot.depth != self._depth:
                self._depth = snapshot.depth
                changes["registers"] += 1
            for peer_id, peer_data in snapshot.peers.items():
                pdata = {f.name: peer_data[f.name] for f in fields(PeerRecord) if f.name in peer_data}
                incoming = PeerRecord(node_id=peer_id, **pdata)
                current = self._peers.get(peer_id)
                if current is None or incoming.last_seen_ms >= current.last_seen_ms:
                    self._peers[peer_id] = incoming
                    changes["peers"] += 1
            for key, value in snapshot.registers.items():
                vdata = {f.name: value[f.name] for f in fields(LWWValue) if f.name in value}
                incoming = LWWValue(**vdata)
                current = self._registers.get(key)
                if current is None or incoming.version > current.version or (
                    incoming.version == current.version and incoming.updated_at_ms >= current.updated_at_ms
                ):
                    self._registers[key] = incoming
                    changes["registers"] += 1
            for task_id, payload in snapshot.tasks.items():
                if self._tasks.get(task_id) != payload:
                    self._tasks[task_id] = payload
                    changes["tasks"] += 1
            if snapshot.alerts:
                existing = {json.dumps(x, sort_keys=True) for x in self._alerts}
                for alert in snapshot.alerts:
                    fp = json.dumps(alert, sort_keys=True)
                    if fp not in existing:
                        self._alerts.append(alert)
                        existing.add(fp)
                        changes["alerts"] += 1
            self._bump_version_locked()
            self._metrics["state_merges"] += 1
            self._metrics["last_sync_ms"] = current_time_ms()
        self.persist()
        return changes

    def known_peer_ids(self) -> List[str]:
        with self._lock:
            return sorted(self._peers.keys())

    def peer_snapshot(self, peer_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            p = self._peers.get(peer_id)
            return asdict(p) if p else None

    def register_snapshot(self, key: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            v = self._registers.get(key)
            return asdict(v) if v else None

    def get_all_registers(self) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            return {k: asdict(v) for k, v in self._registers.items()}

    def get_metrics(self) -> Dict[str, Any]:
        with self._lock:
            return self._metrics.copy()

    def increment_metric(self, key: str, amount: int = 1) -> None:
        with self._lock:
            self._metrics[key] = self._metrics.get(key, 0) + amount

    def prune_stale_peers(self, timeout_s: float) -> List[str]:
        now = current_time_ms()
        removed: List[str] = []
        with self._lock:
            for peer_id, peer in list(self._peers.items()):
                if (now - peer.last_seen_ms) / 1000.0 > timeout_s:
                    self._peers.pop(peer_id, None)
                    removed.append(peer_id)
                    self._metrics["peer_timeouts"] += 1
                    self._bump_version_locked()
        if removed:
            self.persist()
        return removed


# ---------------------------------------------------------------------------
# MQTT client
# ---------------------------------------------------------------------------


def _create_mqtt_client(*, client_id: str, clean_session: bool = False) -> Any:
    if mqtt is None:
        raise RuntimeError("paho-mqtt not installed")
    kwargs: Dict[str, Any] = {"client_id": client_id, "clean_session": clean_session}
    try:
        api = mqtt.CallbackAPIVersion.VERSION1  # type: ignore[attr-defined]
        return mqtt.Client(api, **kwargs)  # type: ignore[misc]
    except Exception:
        try:
            return mqtt.Client(client_id=client_id, clean_session=clean_session)  # type: ignore[misc]
        except TypeError:
            return mqtt.Client(client_id=client_id)  # type: ignore[misc]


class FoxMQTransportError(RuntimeError):
    pass


class MQTTTransport(Protocol):
    def connect(self) -> None: ...
    def disconnect(self) -> None: ...
    def publish(self, topic: str, payload: str, qos: int = 0, retain: bool = False) -> Any: ...
    def subscribe(self, topic: str, qos: int = 0) -> Any: ...


@dataclass(slots=True)
class PendingPublish:
    message_id: str
    topic: str
    envelope: MeshEnvelope
    qos: int
    retain: bool
    created_at_ms: int
    deadline_s: float
    retry_count: int = 0
    acknowledged: bool = False
    ack_time_ms: Optional[int] = None
    mid: Optional[int] = None


class FoxMQClient:
    def __init__(self, config: FoxMQConfig, state_store: SwarmStateStore, event_bus: Optional[EventBus] = None) -> None:
        self.config = config
        self.config.validate()
        self.state_store = state_store
        self.event_bus = event_bus or EventBus()
        self.id_gen = MessageIdGenerator(config.node_id)
        self.dedupe = DedupeCache(ttl_s=config.dedupe_ttl_s, max_items=config.max_recent_message_ids)
        self.backoff = ExponentialBackoff(config.reconnect_min_backoff_s, config.reconnect_max_backoff_s)
        self._stop = threading.Event()
        self._connected = threading.Event()
        self._client: Any = None
        self._callbacks: Dict[str, List[Callable[[MeshEnvelope], None]]] = defaultdict(list)
        self._pending: Dict[str, PendingPublish] = {}
        self._pending_lock = threading.RLock()
        self._threads: List[threading.Thread] = []
        self._outbox: "queue.Queue[Tuple[str, MeshEnvelope, int, bool]]" = queue.Queue(maxsize=8192)
        self._subscribe_topics: Set[str] = set()

    def connect(self) -> None:
        if mqtt is None:
            raise FoxMQTransportError("paho-mqtt is not installed.")
        client = _create_mqtt_client(client_id=self.config.client_id or "foxmq", clean_session=False)
        if self.config.username is not None:
            client.username_pw_set(self.config.username, self.config.password)
        if self.config.use_tls:
            client.tls_set(
                ca_certs=str(self.config.tls_ca_path) if self.config.tls_ca_path else None,
                certfile=str(self.config.tls_cert_path) if self.config.tls_cert_path else None,
                keyfile=str(self.config.tls_key_path) if self.config.tls_key_path else None,
            )
        client.on_connect = self._on_connect
        client.on_disconnect = self._on_disconnect
        client.on_message = self._on_message
        client.on_publish = self._on_publish
        client.reconnect_delay_set(self.config.reconnect_min_backoff_s, self.config.reconnect_max_backoff_s)
        self._client = client
        last_error: Optional[BaseException] = None
        deadline = time.time() + self.config.connect_timeout_s
        for host in self.config.broker_hosts:
            try:
                client.connect(host, self.config.broker_port, self.config.keepalive)
                self._connected.set()
                self._start_loops()
                return
            except BaseException as exc:  # pragma: no cover
                last_error = exc
                LOG.warning("FoxMQ broker %s:%s: %s", host, self.config.broker_port, exc)
                if time.time() >= deadline:
                    break
        raise FoxMQTransportError(f"Unable to connect to any broker: {last_error}")

    def disconnect(self) -> None:
        self._stop.set()
        self._connected.clear()
        if self._client is not None:
            try:
                self._client.disconnect()
            except Exception:
                LOG.exception("disconnect failed")
        for t in self._threads:
            t.join(timeout=1.0)
        self.state_store.persist()

    def loop_forever(self) -> None:
        if self._client is None:
            raise FoxMQTransportError("client is not connected")
        try:
            self._client.loop_forever(retry_first_connection=True)
        finally:
            self.disconnect()

    def start_background(self) -> None:
        if self._client is None:
            raise FoxMQTransportError("client is not connected")
        t = threading.Thread(target=self._client.loop_start, name="foxmq-loop", daemon=True)
        t.start()
        self._threads.append(t)
        self._start_loops()

    def _start_loops(self) -> None:
        if any(getattr(t, "name", "") == "foxmq-outbox" for t in self._threads):
            return
        for name, target in (
            ("foxmq-outbox", self._outbox_loop),
            ("foxmq-retry", self._retry_loop),
            ("foxmq-heartbeat", self._heartbeat_loop),
            ("foxmq-sync", self._sync_loop),
        ):
            t = threading.Thread(target=target, name=name, daemon=True)
            t.start()
            self._threads.append(t)

    def subscribe_default_topics(self) -> None:
        for topic in FoxMQTopic:
            self.subscribe(topic)

    def subscribe(self, topic: FoxMQTopic | str, qos: Optional[int] = None) -> None:
        qos = self.config.qos if qos is None else qos
        topic_str = self.config.topic(topic)
        self._subscribe_topics.add(topic_str)
        if self._client is not None:
            self._client.subscribe(topic_str, qos=qos)

    def on(self, topic: FoxMQTopic | str, handler: Callable[[MeshEnvelope], None]) -> None:
        self._callbacks[self.config.topic(topic)].append(handler)

    def _dispatch_topic_handlers(self, envelope: MeshEnvelope) -> None:
        for handler in self._callbacks.get(envelope.topic, ()):
            try:
                handler(envelope)
            except Exception:
                LOG.exception("topic handler failed for %s", envelope.topic)

    def publish_envelope(
        self, envelope: MeshEnvelope, qos: Optional[int] = None, retain: bool = False, *, reliable: bool = True
    ) -> str:
        qos = self.config.qos if qos is None else qos
        if qos == 0 and reliable:
            qos = 1
        self.state_store.increment_metric("messages_sent")
        if reliable and envelope.kind in {
            MessageKind.ROLE,
            MessageKind.STATE,
            MessageKind.STATE_REQUEST,
            MessageKind.STATE_RESPONSE,
            MessageKind.TASK,
            MessageKind.TASK_BID,
            MessageKind.TASK_COMMIT,
            MessageKind.ALERT,
            MessageKind.SAFETY,
        }:
            self._enqueue_outbox(envelope.topic, envelope, qos, retain)
            return envelope.message_id
        self._publish_raw(envelope.topic, envelope.to_json(), qos=qos, retain=retain)
        return envelope.message_id

    def _enqueue_outbox(self, topic: str, envelope: MeshEnvelope, qos: int, retain: bool) -> None:
        try:
            self._outbox.put_nowait((topic, envelope, qos, retain))
        except queue.Full as exc:
            raise FoxMQTransportError("FoxMQ outbox queue is full") from exc

    def _publish_raw(self, topic: str, payload: str, qos: int = 2, retain: bool = False) -> Optional[int]:
        if self._client is None:
            raise FoxMQTransportError("client is not connected")
        info = self._client.publish(topic, payload, qos=qos, retain=retain)
        mid: Optional[int] = None
        if hasattr(info, "mid"):
            mid = int(info.mid)  # type: ignore[arg-type]
        rc = getattr(info, "rc", 0)
        try:
            rc_int = int(getattr(rc, "value", rc))
        except Exception:
            rc_int = 0
        if rc_int != 0:
            raise FoxMQTransportError(f"publish failed rc={rc} topic={topic}")
        return mid

    def publish(
        self,
        kind: MessageKind,
        topic: FoxMQTopic | str,
        payload: Dict[str, Any],
        *,
        ttl: int = 4,
        qos: Optional[int] = None,
        retain: bool = False,
        reply_to: Optional[str] = None,
        correlation_id: Optional[str] = None,
        reliable: bool = True,
    ) -> str:
        message_id, seq = self.id_gen.next(kind.value)
        full_topic = self.config.topic(topic)
        envelope = MeshEnvelope(
            kind=kind,
            swarm_id=self.config.swarm_id,
            sender_id=self.config.node_id,
            topic=full_topic,
            message_id=message_id,
            timestamp_ms=current_time_ms(),
            seq=seq,
            payload=payload,
            ttl=ttl,
            reply_to=reply_to,
            correlation_id=correlation_id,
            trace_id=payload.get("trace_id"),
            causal_version=self.state_store.version,
        )
        return self.publish_envelope(envelope, qos=qos, retain=retain, reliable=reliable)

    def publish_hello(self, extra: Optional[Dict[str, Any]] = None) -> str:
        payload: Dict[str, Any] = {
            "node_id": self.config.node_id,
            "role": self.state_store.role,
            "depth": self.state_store.depth,
            "status": self.state_store.status,
            "metrics": self.state_store.get_metrics(),
        }
        if extra:
            payload.update(extra)
        return self.publish(MessageKind.HELLO, FoxMQTopic.HELLO, payload)

    def publish_heartbeat(self) -> str:
        now = current_time_ms()
        payload = {
            "node_id": self.config.node_id,
            "ts_ms": now,
            "role": self.state_store.role,
            "depth": self.state_store.depth,
            "status": self.state_store.status,
            "version": self.state_store.version,
            "registers": self.state_store.get_all_registers(),
            "peers": self.state_store.known_peer_ids(),
        }
        return self.publish(MessageKind.HEARTBEAT, FoxMQTopic.HEARTBEAT, payload)

    def publish_state_snapshot(self, target_peer: Optional[str] = None) -> str:
        snap = self.state_store.snapshot()
        payload = json.loads(snap.to_json())
        if target_peer:
            payload["target_peer"] = target_peer
        return self.publish(MessageKind.STATE, FoxMQTopic.STATE, payload)

    def request_state_sync(self, peer_id: str) -> str:
        payload = {
            "requester_id": self.config.node_id,
            "known_version": self.state_store.version,
            "known_peers": self.state_store.known_peer_ids(),
        }
        return self.publish(MessageKind.STATE_REQUEST, FoxMQTopic.STATE_REQUEST, payload, reply_to=peer_id)

    def respond_state_sync(self, requester_id: str) -> str:
        snap = self.state_store.snapshot()
        payload = {"responder_id": self.config.node_id, "snapshot": json.loads(snap.to_json())}
        return self.publish(MessageKind.STATE_RESPONSE, FoxMQTopic.STATE_RESPONSE, payload, correlation_id=requester_id)

    def publish_role_update(self, role: str, *, reason: str = "update", extra: Optional[Dict[str, Any]] = None) -> str:
        payload: Dict[str, Any] = {
            "node_id": self.config.node_id,
            "role": role,
            "reason": reason,
            "depth": self.state_store.depth,
            "version": self.state_store.version,
        }
        if extra:
            payload.update(extra)
        return self.publish(MessageKind.ROLE, FoxMQTopic.ROLE, payload)

    def publish_alert(self, alert_type: str, details: Dict[str, Any], *, severity: str = "warning") -> str:
        return self.publish(
            MessageKind.ALERT,
            FoxMQTopic.ALERT,
            {
                "node_id": self.config.node_id,
                "alert_type": alert_type,
                "severity": severity,
                "details": details,
                "ts_ms": current_time_ms(),
            },
        )

    def publish_safety_stop(self, reason: str, details: Optional[Dict[str, Any]] = None) -> str:
        return self.publish(
            MessageKind.SAFETY,
            FoxMQTopic.SAFETY,
            {"node_id": self.config.node_id, "reason": reason, "details": details or {}, "ts_ms": current_time_ms()},
            ttl=2,
            reliable=True,
        )

    def publish_task(self, task_id: str, task_type: str, requirements: Dict[str, Any], *, ttl: int = 4) -> str:
        return self.publish(
            MessageKind.TASK,
            FoxMQTopic.TASK,
            {
                "task_id": task_id,
                "task_type": task_type,
                "requirements": requirements,
                "proposer_id": self.config.node_id,
                "ts_ms": current_time_ms(),
            },
            ttl=ttl,
        )

    def bid_for_task(self, task_id: str, bid: Dict[str, Any]) -> str:
        return self.publish(
            MessageKind.TASK_BID,
            FoxMQTopic.TASK_BID,
            {"task_id": task_id, "bidder_id": self.config.node_id, "bid": bid, "ts_ms": current_time_ms()},
        )

    def commit_task(self, task_id: str, assignee_id: str, rationale: Dict[str, Any]) -> str:
        return self.publish(
            MessageKind.TASK_COMMIT,
            FoxMQTopic.TASK_COMMIT,
            {
                "task_id": task_id,
                "assignee_id": assignee_id,
                "rationale": rationale,
                "committer_id": self.config.node_id,
                "ts_ms": current_time_ms(),
            },
        )

    def publish_gossip(self, peer_ids: Sequence[str]) -> str:
        return self.publish(
            MessageKind.GOSSIP,
            FoxMQTopic.GOSSIP,
            {"node_id": self.config.node_id, "known_peers": list(peer_ids), "ts_ms": current_time_ms()},
            ttl=3,
            reliable=False,
        )

    def publish_ping(self, target_peer: str) -> str:
        return self.publish(
            MessageKind.PING,
            FoxMQTopic.PING,
            {"from": self.config.node_id, "to": target_peer, "ts_ms": current_time_ms()},
            reply_to=target_peer,
            ttl=2,
            reliable=False,
        )

    def _on_connect(self, client: Any, userdata: Any, flags: Any, rc: Any, *args: Any) -> None:  # pragma: no cover
        if _mqtt_success(rc):
            LOG.info("connected to FoxMQ")
            self._connected.set()
            for topic in sorted(self._subscribe_topics):
                client.subscribe(topic, qos=self.config.qos)
            self.subscribe_default_topics()
            self.publish_hello({"connected": True})
            self.event_bus.emit("connected", {"node_id": self.config.node_id, "swarm_id": self.config.swarm_id})
        else:
            LOG.warning("FoxMQ connection failed rc=%s", rc)

    def _on_disconnect(self, client: Any, userdata: Any, rc: Any, *args: Any) -> None:  # pragma: no cover
        self._connected.clear()
        if not self._stop.is_set():
            LOG.warning("FoxMQ disconnected rc=%s", rc)
            self.event_bus.emit("disconnected", {"node_id": self.config.node_id, "rc": rc})

    def _on_publish(self, client: Any, userdata: Any, mid: int, *args: Any) -> None:  # pragma: no cover
        with self._pending_lock:
            for msg_id, pending in list(self._pending.items()):
                if pending.mid is not None and pending.mid == mid:
                    pending.acknowledged = True
                    pending.ack_time_ms = current_time_ms()
                    self._pending.pop(msg_id, None)
                    self.state_store.increment_metric("acks_received")
                    self.event_bus.emit("publish_ack", {"message_id": msg_id, "mid": mid})
                    return

    def _on_message(self, client: Any, userdata: Any, msg: Any) -> None:  # pragma: no cover
        try:
            raw = msg.payload.decode("utf-8") if isinstance(msg.payload, (bytes, bytearray)) else str(msg.payload)
            envelope = MeshEnvelope.from_json(raw)
        except Exception:
            LOG.exception("decode failed on topic %s", getattr(msg, "topic", "?"))
            return
        if envelope.swarm_id != self.config.swarm_id:
            return
        if envelope.sender_id == self.config.node_id:
            return
        dedupe_key = f"id:{envelope.message_id}"
        if self.dedupe.seen(dedupe_key):
            return
        fp = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        if self.dedupe.seen(f"fp:{fp}"):
            return

        self.state_store.increment_metric("messages_received")
        snap = self.state_store.peer_snapshot(envelope.sender_id)
        self.state_store.touch_peer(
            envelope.sender_id,
            role=envelope.payload.get("role", (snap or {}).get("role", "standby")),
            status=envelope.payload.get("status", "ready"),
            depth=int(envelope.payload.get("depth", 0)),
            version=int(envelope.causal_version),
        )

        if envelope.kind == MessageKind.ACK:
            self._handle_ack(envelope)
            self._dispatch_topic_handlers(envelope)
            return

        if envelope.kind == MessageKind.HEARTBEAT:
            self._handle_heartbeat(envelope)
        elif envelope.kind == MessageKind.HELLO:
            self._handle_hello(envelope)
        elif envelope.kind == MessageKind.STATE:
            self._handle_state(envelope)
        elif envelope.kind == MessageKind.STATE_REQUEST:
            self._handle_state_request(envelope)
        elif envelope.kind == MessageKind.STATE_RESPONSE:
            self._handle_state_response(envelope)
        elif envelope.kind == MessageKind.ROLE:
            self._handle_role(envelope)
        elif envelope.kind == MessageKind.TASK:
            self._handle_task(envelope)
        elif envelope.kind == MessageKind.TASK_BID:
            self._handle_task_bid(envelope)
        elif envelope.kind == MessageKind.TASK_COMMIT:
            self._handle_task_commit(envelope)
        elif envelope.kind == MessageKind.ALERT:
            self._handle_alert(envelope)
        elif envelope.kind == MessageKind.SAFETY:
            self._handle_safety(envelope)
        elif envelope.kind == MessageKind.GOSSIP:
            self._handle_gossip(envelope)
        elif envelope.kind == MessageKind.PING:
            self._handle_ping(envelope)
        else:
            self._handle_custom(envelope)

        self.event_bus.emit(envelope.kind.value, {"envelope": asdict(envelope)})
        self._dispatch_topic_handlers(envelope)
        self._emit_ack(envelope)

    def _emit_ack(self, envelope: MeshEnvelope) -> None:
        self.publish(
            MessageKind.ACK,
            FoxMQTopic.ACK,
            {
                "ack_for": envelope.message_id,
                "ack_from": self.config.node_id,
                "ack_to": envelope.sender_id,
                "ack_kind": envelope.kind.value,
                "ack_ts_ms": current_time_ms(),
            },
            reply_to=envelope.sender_id,
            correlation_id=envelope.message_id,
            reliable=False,
        )

    def _handle_ack(self, envelope: MeshEnvelope) -> None:
        ack_for = envelope.payload.get("ack_for")
        if not ack_for:
            return
        with self._pending_lock:
            pending = self._pending.get(str(ack_for))
            if pending is not None:
                pending.acknowledged = True
                pending.ack_time_ms = current_time_ms()
                self._pending.pop(str(ack_for), None)
                self.state_store.increment_metric("acks_received")

    def _handle_hello(self, envelope: MeshEnvelope) -> None:
        self.state_store.touch_peer(
            envelope.sender_id,
            role=envelope.payload.get("role", "standby"),
            status=envelope.payload.get("status", "ready"),
            depth=int(envelope.payload.get("depth", 0)),
            battery=float(envelope.payload.get("battery", 1.0)),
            version=int(envelope.payload.get("version", envelope.causal_version)),
        )
        self.event_bus.emit("peer_hello", {"peer_id": envelope.sender_id, "payload": envelope.payload})

    def _handle_heartbeat(self, envelope: MeshEnvelope) -> None:
        self.state_store.touch_peer(
            envelope.sender_id,
            role=envelope.payload.get("role", "standby"),
            status=envelope.payload.get("status", "ready"),
            depth=int(envelope.payload.get("depth", 0)),
            latency_ms=float(envelope.payload.get("latency_ms", 0.0)),
            loss_rate=float(envelope.payload.get("loss_rate", 0.0)),
            version=int(envelope.payload.get("version", envelope.causal_version)),
        )
        self.event_bus.emit("heartbeat", {"peer_id": envelope.sender_id})

    def _handle_state(self, envelope: MeshEnvelope) -> None:
        snap = MeshStateSnapshot.from_dict(envelope.payload)
        changes = self.state_store.merge_snapshot(snap)
        self.state_store.increment_metric("syncs")
        self.event_bus.emit("state_merge", {"peer_id": envelope.sender_id, "changes": changes})

    def _handle_state_request(self, envelope: MeshEnvelope) -> None:
        requester = envelope.payload.get("requester_id") or envelope.reply_to or envelope.sender_id
        if requester == self.config.node_id:
            return
        self.respond_state_sync(str(requester))

    def _handle_state_response(self, envelope: MeshEnvelope) -> None:
        snap_data = envelope.payload.get("snapshot")
        if not snap_data:
            return
        snap = MeshStateSnapshot.from_dict(snap_data)
        changes = self.state_store.merge_snapshot(snap)
        self.event_bus.emit("state_sync_response", {"peer_id": envelope.sender_id, "changes": changes})

    def _handle_role(self, envelope: MeshEnvelope) -> None:
        role = envelope.payload.get("role")
        if isinstance(role, str):
            self.state_store.touch_peer(
                envelope.sender_id,
                role=role,
                depth=int(envelope.payload.get("depth", 0)),
                status=envelope.payload.get("status", "ready"),
                version=int(envelope.payload.get("version", envelope.causal_version)),
            )
            self.event_bus.emit("role_update", {"peer_id": envelope.sender_id, "role": role})

    def _handle_task(self, envelope: MeshEnvelope) -> None:
        task_id = str(envelope.payload.get("task_id", envelope.message_id))
        self.state_store.upsert_task(task_id, envelope.payload)
        self.event_bus.emit("task_proposal", {"task_id": task_id, "payload": envelope.payload})

    def _handle_task_bid(self, envelope: MeshEnvelope) -> None:
        task_id = str(envelope.payload.get("task_id", envelope.message_id))
        bids = self.state_store.register_snapshot(f"task_bids:{task_id}")
        cur = bids["value"] if bids and isinstance(bids.get("value"), list) else []
        cur = list(cur)
        cur.append(envelope.payload)
        self.state_store.update_register(f"task_bids:{task_id}", cur, source_id=envelope.sender_id)
        self.event_bus.emit("task_bid", {"task_id": task_id})

    def _handle_task_commit(self, envelope: MeshEnvelope) -> None:
        task_id = str(envelope.payload.get("task_id", envelope.message_id))
        merged = {**self.state_store.get_task_payload(task_id), **envelope.payload, "committed": True}
        self.state_store.upsert_task(task_id, merged)
        self.event_bus.emit("task_commit", {"task_id": task_id})

    def _handle_alert(self, envelope: MeshEnvelope) -> None:
        self.state_store.record_alert(envelope.payload)
        self.event_bus.emit("alert", {"payload": envelope.payload})

    def _handle_safety(self, envelope: MeshEnvelope) -> None:
        self.state_store.record_alert({"type": "safety", **envelope.payload})
        self.event_bus.emit("safety", {"payload": envelope.payload})

    def _handle_gossip(self, envelope: MeshEnvelope) -> None:
        for peer_id in envelope.payload.get("known_peers", []):
            if peer_id and peer_id != self.config.node_id:
                if self.state_store.peer_snapshot(peer_id) is None:
                    self.state_store.touch_peer(peer_id, status="gossiped")

    def _handle_ping(self, envelope: MeshEnvelope) -> None:
        if envelope.payload.get("to") not in (None, self.config.node_id):
            return
        self.event_bus.emit("ping", {"peer_id": envelope.sender_id})

    def _handle_custom(self, envelope: MeshEnvelope) -> None:
        self.event_bus.emit("custom", {"peer_id": envelope.sender_id, "payload": envelope.payload})

    def _outbox_loop(self) -> None:
        while not self._stop.is_set():
            try:
                topic, envelope, qos, retain = self._outbox.get(timeout=0.25)
            except queue.Empty:
                continue
            deadline = time.time() + self.config.publish_ack_timeout_s
            pending = PendingPublish(
                message_id=envelope.message_id,
                topic=topic,
                envelope=envelope,
                qos=qos,
                retain=retain,
                created_at_ms=current_time_ms(),
                deadline_s=deadline,
            )
            with self._pending_lock:
                self._pending[envelope.message_id] = pending
            try:
                mid = self._publish_raw(topic, envelope.to_json(), qos=qos, retain=retain)
                pending.mid = mid
            except Exception:
                LOG.exception("publish failed %s", envelope.message_id)
                with self._pending_lock:
                    pending.retry_count += 1
                    pending.deadline_s = time.time() + self.config.publish_ack_timeout_s
                self.state_store.increment_metric("retries")
                self._outbox.put((topic, envelope, qos, retain))
            finally:
                self._outbox.task_done()

    def _retry_loop(self) -> None:
        while not self._stop.is_set():
            time.sleep(0.25)
            expired: List[str] = []
            with self._pending_lock:
                for message_id, pending in list(self._pending.items()):
                    if pending.acknowledged:
                        expired.append(message_id)
                        continue
                    if time.time() >= pending.deadline_s:
                        if pending.retry_count >= self.config.publish_retry_limit:
                            LOG.error("dropping unacked message: %s", message_id)
                            expired.append(message_id)
                            continue
                        pending.retry_count += 1
                        pending.deadline_s = time.time() + self.config.publish_ack_timeout_s * (1.2 ** pending.retry_count)
                        self.state_store.increment_metric("retries")
                        try:
                            mid = self._publish_raw(pending.topic, pending.envelope.to_json(), qos=pending.qos, retain=pending.retain)
                            pending.mid = mid
                        except Exception:
                            LOG.exception("retry publish failed %s", message_id)
            if expired:
                with self._pending_lock:
                    for mid in expired:
                        self._pending.pop(mid, None)

    def _heartbeat_loop(self) -> None:
        while not self._stop.is_set():
            if self._stop.wait(self.config.heartbeat_interval_s):
                break
            try:
                self.publish_heartbeat()
            except Exception:
                LOG.exception("heartbeat publish failed")

    def _sync_loop(self) -> None:
        last = 0
        while not self._stop.is_set():
            if self._stop.wait(self.config.state_sync_interval_s):
                break
            now = current_time_ms()
            if now - last < int(self.config.state_sync_interval_s * 1000):
                continue
            last = now
            try:
                self.publish_state_snapshot()
            except Exception:
                LOG.exception("state snapshot failed")

    def get_snapshot(self) -> MeshStateSnapshot:
        return self.state_store.snapshot()

    def find_best_peer(self) -> Optional[str]:
        candidates: List[Tuple[float, str]] = []
        for peer_id in self.state_store.known_peer_ids():
            peer = self.state_store.peer_snapshot(peer_id)
            if not peer:
                continue
            score = (
                float(peer.get("depth", 0)) * 1000.0
                - float(peer.get("loss_rate", 0.0)) * 500.0
                - float(peer.get("latency_ms", 0.0)) * 0.5
                + (0.1 if peer.get("status", "ready") == "ready" else 0.0)
            )
            candidates.append((score, peer_id))
        if not candidates:
            return None
        candidates.sort(reverse=True)
        return candidates[0][1]

    def force_resync(self) -> None:
        self.publish_state_snapshot()


class FoxMQMeshAdapter:
    def __init__(self, client: FoxMQClient, state_store: SwarmStateStore, event_bus: Optional[EventBus] = None) -> None:
        self.client = client
        self.state_store = state_store
        self.event_bus = event_bus or EventBus()
        self._stop = threading.Event()
        self._loop_thread: Optional[threading.Thread] = None
        self.client.on(FoxMQTopic.HEARTBEAT, self._on_heartbeat)
        self.client.on(FoxMQTopic.ROLE, self._on_role)
        self.client.on(FoxMQTopic.TASK, self._on_task)
        self.client.on(FoxMQTopic.TASK_BID, self._on_task_bid)
        self.client.on(FoxMQTopic.TASK_COMMIT, self._on_task_commit)
        self.client.on(FoxMQTopic.ALERT, self._on_alert)
        self.client.on(FoxMQTopic.SAFETY, self._on_safety)
        self.client.on(FoxMQTopic.GOSSIP, self._on_gossip)

    def start(self) -> None:
        self.client.subscribe_default_topics()
        self.client.start_background()
        self.client.publish_hello({"adapter": "started"})
        self._loop_thread = threading.Thread(target=self._maintenance_loop, name="foxmq-adapter", daemon=True)
        self._loop_thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._loop_thread:
            self._loop_thread.join(timeout=1.0)

    def announce_role(self, role: str, reason: str = "mission_update") -> None:
        self.state_store.set_role(role)
        self.client.publish_role_update(role, reason=reason)

    def update_depth(self, depth: int) -> None:
        self.state_store.set_depth(depth)
        self.client.publish_role_update(self.state_store.role, reason="depth_update", extra={"depth": depth})

    def update_status(self, status: str) -> None:
        self.state_store.set_status(status)
        self.client.publish_heartbeat()

    def broadcast_safety_stop(self, reason: str, details: Optional[Dict[str, Any]] = None) -> None:
        self.state_store.record_alert({"type": "safety_stop", "reason": reason, "details": details or {}})
        self.client.publish_safety_stop(reason, details)

    def request_full_sync(self) -> None:
        best = self.client.find_best_peer()
        if best:
            self.client.request_state_sync(best)
        else:
            self.client.force_resync()

    def health_summary(self) -> Dict[str, Any]:
        s = self.state_store.snapshot()
        return {
            "node_id": s.node_id,
            "swarm_id": s.swarm_id,
            "role": s.role,
            "status": s.status,
            "depth": s.depth,
            "version": s.version,
            "peer_count": len(s.peers),
            "task_count": len(s.tasks),
            "metrics": s.metrics,
        }

    def dump_debug_bundle(self) -> str:
        return json.dumps(
            {
                "health": self.health_summary(),
                "subscribed": sorted(self.client._subscribe_topics),
            },
            indent=2,
            sort_keys=True,
        )

    def _on_heartbeat(self, envelope: MeshEnvelope) -> None:
        self.event_bus.emit("heartbeat_seen", {"peer_id": envelope.sender_id, "payload": envelope.payload})

    def _on_role(self, envelope: MeshEnvelope) -> None:
        self.event_bus.emit("role_seen", {"peer_id": envelope.sender_id, "payload": envelope.payload})

    def _on_task(self, envelope: MeshEnvelope) -> None:
        self.event_bus.emit("task_seen", {"task_id": envelope.payload.get("task_id"), "payload": envelope.payload})

    def _on_task_bid(self, envelope: MeshEnvelope) -> None:
        self.event_bus.emit("task_bid_seen", {"payload": envelope.payload})

    def _on_task_commit(self, envelope: MeshEnvelope) -> None:
        self.event_bus.emit("task_commit_seen", {"payload": envelope.payload})

    def _on_alert(self, envelope: MeshEnvelope) -> None:
        self.event_bus.emit("alert_seen", {"payload": envelope.payload})

    def _on_safety(self, envelope: MeshEnvelope) -> None:
        self.event_bus.emit("safety_seen", {"payload": envelope.payload})

    def _on_gossip(self, envelope: MeshEnvelope) -> None:
        self.event_bus.emit("gossip_seen", {"payload": envelope.payload})

    def _maintenance_loop(self) -> None:
        while not self._stop.is_set():
            self.state_store.prune_stale_peers(self.client.config.heartbeat_timeout_s)
            if self._stop.wait(1.0):
                break


@dataclass(slots=True)
class TaskBid:
    task_id: str
    bidder_id: str
    score: float
    eta_ms: int
    resources: Dict[str, Any] = field(default_factory=dict)
    notes: Dict[str, Any] = field(default_factory=dict)
    ts_ms: int = field(default_factory=current_time_ms)


class TaskAuctioneer:
    def __init__(self, client: FoxMQClient, state_store: SwarmStateStore, event_bus: Optional[EventBus] = None) -> None:
        self.client = client
        self.state_store = state_store
        self.event_bus = event_bus or EventBus()
        self._lock = threading.RLock()
        self._auctions: Dict[str, Dict[str, Any]] = {}
        self.client.on(FoxMQTopic.TASK, self._on_task)
        self.client.on(FoxMQTopic.TASK_BID, self._on_bid)
        self.client.on(FoxMQTopic.TASK_COMMIT, self._on_commit)

    def propose_task(self, task_id: str, task_type: str, requirements: Dict[str, Any]) -> None:
        with self._lock:
            self._auctions[task_id] = {"task_type": task_type, "requirements": requirements}
        self.client.publish_task(task_id, task_type, requirements)

    def submit_bid(self, task_id: str, *, score: float, eta_ms: int, resources: Optional[Dict[str, Any]] = None) -> None:
        bid = TaskBid(task_id=task_id, bidder_id=self.state_store.node_id, score=score, eta_ms=eta_ms, resources=resources or {})
        self.client.bid_for_task(task_id, asdict(bid))

    def maybe_commit(self, task_id: str) -> Optional[str]:
        bids = self.state_store.register_snapshot(f"task_bids:{task_id}")
        raw = bids["value"] if bids else []
        if not isinstance(raw, list) or not raw:
            return None

        def _score(b: Dict[str, Any]) -> float:
            if "score" in b:
                return float(b["score"])
            bid = b.get("bid")
            if isinstance(bid, dict):
                return float(bid.get("score", 0.0))
            return 0.0

        best = max(raw, key=_score)
        wid = str(best.get("bidder_id", ""))
        if not wid:
            return None
        self.client.commit_task(task_id, wid, {"reason": "auction", "winner": best})
        return wid

    def _on_task(self, envelope: MeshEnvelope) -> None:
        tid = str(envelope.payload.get("task_id", envelope.message_id))
        with self._lock:
            self._auctions.setdefault(tid, {})

    def _on_bid(self, envelope: MeshEnvelope) -> None:
        pass

    def _on_commit(self, envelope: MeshEnvelope) -> None:
        pass


class RecoveryCoordinator:
    """Optional recovery helpers; :class:`FoxMQClient` already merges STATE / STATE_RESPONSE."""

    def __init__(self, client: FoxMQClient, state_store: SwarmStateStore, event_bus: Optional[EventBus] = None) -> None:
        self.client = client
        self.state_store = state_store
        self.event_bus = event_bus or EventBus()

    def sync_with_best_peer(self) -> None:
        peer = self.client.find_best_peer()
        if peer:
            self.client.request_state_sync(peer)
        else:
            self.client.force_resync()


class FoxMQBridge:
    def __init__(self, adapter: FoxMQMeshAdapter, auctioneer: Optional[TaskAuctioneer] = None, recovery: Optional[RecoveryCoordinator] = None) -> None:
        self.adapter = adapter
        self.auctioneer = auctioneer or TaskAuctioneer(adapter.client, adapter.state_store, adapter.event_bus)
        self.recovery = recovery or RecoveryCoordinator(adapter.client, adapter.state_store, adapter.event_bus)
        self.event_bus = adapter.event_bus
        self._started = False

    def start(self) -> None:
        if self._started:
            return
        self.adapter.start()
        self._started = True

    def stop(self) -> None:
        self.adapter.stop()
        self.adapter.client.disconnect()
        self._started = False

    def update_role(self, role: str, reason: str = "manual") -> None:
        self.adapter.announce_role(role, reason=reason)

    def update_depth(self, depth: int) -> None:
        self.adapter.update_depth(depth)

    def submit_sensor_finding(self, finding_id: str, finding: Dict[str, Any]) -> None:
        self.adapter.state_store.update_register(f"finding:{finding_id}", finding)
        self.adapter.client.publish(
            MessageKind.CUSTOM,
            FoxMQTopic.ALERT,
            {"type": "sensor_finding", "finding_id": finding_id, "finding": finding, "node_id": self.adapter.state_store.node_id},
            reliable=False,
        )

    def alert_safety(self, reason: str, details: Dict[str, Any]) -> None:
        self.adapter.broadcast_safety_stop(reason, details)

    def bid_task(self, task_id: str, score: float, eta_ms: int, resources: Optional[Dict[str, Any]] = None) -> None:
        self.auctioneer.submit_bid(task_id, score=score, eta_ms=eta_ms, resources=resources)

    def commit_best_task(self, task_id: str) -> Optional[str]:
        return self.auctioneer.maybe_commit(task_id)

    def request_sync(self) -> None:
        self.adapter.request_full_sync()

    def export_debug(self) -> Dict[str, Any]:
        return {"health": self.adapter.health_summary()}


def build_config(
    swarm_id: str,
    node_id: str,
    broker_hosts: Sequence[str],
    *,
    port: Optional[int] = None,
    persistence_dir: str | Path = ".foxmq",
    secret_key_path: Optional[str | Path] = None,
    qos: int = 2,
) -> FoxMQConfig:
    cfg = FoxMQConfig(
        swarm_id=swarm_id,
        node_id=node_id,
        broker_hosts=list(broker_hosts),
        broker_port=int(port if port is not None else getattr(swarm_config, "FOXMQ_MQTT_PORT", swarm_config.FOXMQ_PORT)),
        persistence_dir=Path(persistence_dir),
        secret_key_path=Path(secret_key_path) if secret_key_path else None,
        qos=qos,
    )
    cfg.validate()
    return cfg


def create_default_adapter(
    swarm_id: str,
    node_id: str,
    broker_hosts: Sequence[str],
    *,
    persistence_dir: str | Path = ".foxmq",
    secret_key_path: Optional[str | Path] = None,
    port: Optional[int] = None,
) -> FoxMQMeshAdapter:
    cfg = build_config(swarm_id, node_id, broker_hosts, port=port, persistence_dir=persistence_dir, secret_key_path=secret_key_path)
    persistence = StatePersistence(cfg.local_state_path)
    store = SwarmStateStore(node_id=node_id, swarm_id=swarm_id, persistence=persistence)
    bus = EventBus()
    client = FoxMQClient(cfg, store, bus)
    return FoxMQMeshAdapter(client, store, bus)


def make_foxmq_bridge(
    swarm_id: str,
    node_id: str,
    broker_hosts: Sequence[str],
    *,
    persistence_dir: str | Path = ".foxmq",
    secret_key_path: Optional[str | Path] = None,
    port: Optional[int] = None,
) -> FoxMQBridge:
    adapter = create_default_adapter(
        swarm_id, node_id, broker_hosts, persistence_dir=persistence_dir, secret_key_path=secret_key_path, port=port
    )
    return FoxMQBridge(adapter)


# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------


class EnvelopeSigner:
    def __init__(self, secret: bytes, *, digestmod: str = "sha256") -> None:
        self.secret = secret
        self.digestmod = digestmod

    def sign_payload(self, envelope: MeshEnvelope) -> str:
        mac = hmac.new(self.secret, envelope.canonical_bytes_for_signing(), getattr(hashlib, self.digestmod))
        return mac.hexdigest()

    def verify_payload(self, envelope: MeshEnvelope, signature: str) -> bool:
        empty = MeshEnvelope(
            kind=envelope.kind,
            swarm_id=envelope.swarm_id,
            sender_id=envelope.sender_id,
            topic=envelope.topic,
            message_id=envelope.message_id,
            timestamp_ms=envelope.timestamp_ms,
            seq=envelope.seq,
            payload=envelope.payload,
            ttl=envelope.ttl,
            reply_to=envelope.reply_to,
            correlation_id=envelope.correlation_id,
            trace_id=envelope.trace_id,
            causal_version=envelope.causal_version,
            signature=None,
        )
        return hmac.compare_digest(self.sign_payload(empty), signature)


@dataclass(slots=True)
class VerificationResult:
    valid: bool
    reason: str = ""


class EnvelopeGuard:
    def __init__(self, signer: Optional[EnvelopeSigner] = None, *, max_clock_skew_ms: int = 15_000) -> None:
        self.signer = signer
        self.max_clock_skew_ms = max_clock_skew_ms
        self._seen: Set[str] = set()
        self._lock = threading.RLock()

    def verify(self, envelope: MeshEnvelope) -> VerificationResult:
        now = current_time_ms()
        if abs(now - envelope.timestamp_ms) > self.max_clock_skew_ms:
            return VerificationResult(False, "timestamp_out_of_window")
        if envelope.signature and self.signer is not None:
            if not self.signer.verify_payload(envelope, envelope.signature):
                return VerificationResult(False, "signature_mismatch")
        with self._lock:
            if envelope.message_id in self._seen:
                return VerificationResult(False, "duplicate_message")
            self._seen.add(envelope.message_id)
        return VerificationResult(True)


# ---------------------------------------------------------------------------
# Mock client (tests)
# ---------------------------------------------------------------------------


class MockFoxMQClient(FoxMQClient):
    """In-memory stand-in: records publishes; call :meth:`inject` to deliver."""

    def __init__(self, config: FoxMQConfig, state_store: SwarmStateStore, event_bus: Optional[EventBus] = None) -> None:
        super().__init__(config, state_store, event_bus)
        self.sent: List[Tuple[str, str, int, bool]] = []
        self._mock_id = MessageIdGenerator(config.node_id)

    def connect(self) -> None:
        self._connected.set()
        self._start_loops()

    def disconnect(self) -> None:
        self._stop.set()

    def start_background(self) -> None:
        self._start_loops()

    def _publish_raw(self, topic: str, payload: str, qos: int = 2, retain: bool = False) -> Optional[int]:
        self.sent.append((topic, payload, qos, retain))
        return random.randint(1, 1_000_000)

    def publish(
        self,
        kind: MessageKind,
        topic: FoxMQTopic | str,
        payload: Dict[str, Any],
        *,
        ttl: int = 4,
        qos: Optional[int] = None,
        retain: bool = False,
        reply_to: Optional[str] = None,
        correlation_id: Optional[str] = None,
        reliable: bool = True,
    ) -> str:
        message_id, seq = self._mock_id.next(kind.value)
        full_topic = self.config.topic(topic)
        envelope = MeshEnvelope(
            kind=kind,
            swarm_id=self.config.swarm_id,
            sender_id=self.config.node_id,
            topic=full_topic,
            message_id=message_id,
            timestamp_ms=current_time_ms(),
            seq=seq,
            payload=payload,
            ttl=ttl,
            reply_to=reply_to,
            correlation_id=correlation_id,
            causal_version=self.state_store.version,
        )
        return self.publish_envelope(envelope, qos=qos, retain=retain, reliable=reliable)

    def inject(self, envelope: MeshEnvelope) -> None:
        self._on_message(None, None, type("M", (), {"payload": envelope.to_json().encode()}))


def topic_matches(topic_filter: str, topic: str) -> bool:
    if topic_filter == topic:
        return True
    f_parts = topic_filter.strip("/").split("/")
    t_parts = topic.strip("/").split("/")
    i = j = 0
    while i < len(f_parts) and j < len(t_parts):
        if f_parts[i] == "#":
            return True
        if f_parts[i] != "+" and f_parts[i] != t_parts[j]:
            return False
        i += 1
        j += 1
    return i == len(f_parts) and j == len(t_parts)


# ---------------------------------------------------------------------------
# Chain manager hook
# ---------------------------------------------------------------------------


def chain_message_from_foxmq_envelope(envelope: MeshEnvelope) -> Tuple[str, Dict[str, Any]]:
    """Map a mesh envelope to ``ChainManager.handle_message`` ``(sender, msg)``."""
    base: Dict[str, Any] = {"type": f"FOXMQ_{envelope.kind.value.upper()}", "foxmq": envelope.payload}
    return envelope.sender_id, base


class ChainFoxMQHook:
    """Attach FoxMQ mesh events to :class:`swarm.chain_manager.ChainManager`."""

    def __init__(self, chain: Any, client: FoxMQClient) -> None:
        self.chain = chain
        self.client = client

    def attach(self) -> None:
        for ev in ("custom", "safety", "heartbeat", "role", "task", "state"):
            self.client.event_bus.on(ev, self._on_bus)

    def _on_bus(self, payload: Dict[str, Any]) -> None:
        env = payload.get("envelope")
        if not isinstance(env, dict):
            return
        try:
            kind_raw = env["kind"]
            kind = MessageKind(kind_raw) if isinstance(kind_raw, str) else kind_raw
            envelope = MeshEnvelope(
                kind=kind,
                swarm_id=str(env["swarm_id"]),
                sender_id=str(env["sender_id"]),
                topic=str(env["topic"]),
                message_id=str(env["message_id"]),
                timestamp_ms=int(env["timestamp_ms"]),
                seq=int(env["seq"]),
                payload=dict(env.get("payload", {})),
                ttl=int(env.get("ttl", 4)),
                reply_to=env.get("reply_to"),
                correlation_id=env.get("correlation_id"),
                trace_id=env.get("trace_id"),
                causal_version=int(env.get("causal_version", 0)),
                signature=env.get("signature"),
            )
        except Exception:
            return
        sender, msg = chain_message_from_foxmq_envelope(envelope)
        self.chain.handle_message(sender, msg)


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="FoxMQ swarm integration smoke test")
    parser.add_argument("--swarm-id", default="blackout-swarm")
    parser.add_argument("--node-id", default="node-1")
    parser.add_argument("--broker-host", action="append", default=["127.0.0.1"])
    parser.add_argument("--port", type=int, default=None)
    parser.add_argument("--persistence-dir", default=".foxmq")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    adapter = create_default_adapter(
        swarm_id=args.swarm_id,
        node_id=args.node_id,
        broker_hosts=args.broker_host,
        persistence_dir=args.persistence_dir,
        port=args.port,
    )
    if args.dry_run:
        print(adapter.dump_debug_bundle())
        return
    adapter.client.connect()
    adapter.start()
    try:
        while True:
            time.sleep(2.0)
            LOG.info("health=%s", adapter.health_summary())
    except KeyboardInterrupt:
        pass
    finally:
        adapter.stop()
        adapter.client.disconnect()


__all__ = [
    "AddressBookEntry",
    "ChainFoxMQHook",
    "DedupeCache",
    "EnvelopeGuard",
    "EnvelopeSigner",
    "EventBus",
    "FoxMQBridge",
    "FoxMQClient",
    "FoxMQClusterSpec",
    "FoxMQConfig",
    "FoxMQMeshAdapter",
    "FoxMQTopic",
    "MeshEnvelope",
    "MeshStateSnapshot",
    "MessageIdGenerator",
    "MessageKind",
    "MockFoxMQClient",
    "RecoveryCoordinator",
    "StatePersistence",
    "SwarmStateStore",
    "TaskAuctioneer",
    "VerificationResult",
    "build_config",
    "chain_message_from_foxmq_envelope",
    "create_default_adapter",
    "current_time_ms",
    "foxmq_config_from_swarm_config",
    "make_foxmq_bridge",
    "swarm_topic",
    "topic_matches",
]

if __name__ == "__main__":  # pragma: no cover
    main()

