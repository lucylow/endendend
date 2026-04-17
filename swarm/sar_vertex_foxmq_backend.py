"""Search-and-rescue backend for Tashi Vertex SDK + FoxMQ P2P integration.

This module is intentionally backend-only. It focuses on:

- mission state and search/rescue scenarios
- immutable event logging and checkpointing
- consensus-style event ordering through a Vertex adapter
- FoxMQ-backed peer messaging and state replication
- rescue task allocation, role negotiation, and recovery workflows
- scenario templates for common SAR situations:
  * collapsed building
  * cave / tunnel
  * flood / water rescue
  * wildfire / smoke
  * industrial / hazardous site
  * forest / open terrain
  * night / low-visibility search
  * multi-room / indoor search
  * perimeter / border sweep
  * disaster triage / victim prioritization

The goal is to provide a repo-ready backend that can be wired into the
existing swarm controllers, chain manager, target manager, and FoxMQ bridge.
The code is self-contained and can be used with either real transports or test
adapters.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import math
import os
import random
import threading
import time
from collections import defaultdict, deque
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, DefaultDict, Deque, Dict, Iterable, List, Optional, Protocol, Sequence, Set, Tuple

LOG = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Common helpers
# ---------------------------------------------------------------------------


def now_ms() -> int:
    return int(time.time() * 1000)


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def euclidean(a: Dict[str, float], b: Dict[str, float]) -> float:
    ax, ay, az = float(a.get("x", 0.0)), float(a.get("y", 0.0)), float(a.get("z", 0.0))
    bx, by, bz = float(b.get("x", 0.0)), float(b.get("y", 0.0)), float(b.get("z", 0.0))
    return math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2)


def manhattan(a: Dict[str, float], b: Dict[str, float]) -> float:
    ax, ay, az = float(a.get("x", 0.0)), float(a.get("y", 0.0)), float(a.get("z", 0.0))
    bx, by, bz = float(b.get("x", 0.0)), float(b.get("y", 0.0)), float(b.get("z", 0.0))
    return abs(ax - bx) + abs(ay - by) + abs(az - bz)


def stable_hash(payload: Any) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def json_dump(data: Any) -> str:
    return json.dumps(data, indent=2, sort_keys=True, default=str)


def canonical_p2p_envelope_json(envelope: "P2PEnvelope") -> str:
    """JSON used for HMAC: all fields except signature (MUST match on verify)."""
    payload = asdict(envelope)
    payload.pop("signature", None)
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def identity_public_dict(identity: "NodeIdentity") -> Dict[str, Any]:
    """Safe for wire: never ship secret_key."""
    d = asdict(identity)
    d.pop("secret_key", None)
    return d


# ---------------------------------------------------------------------------
# Scenario model
# ---------------------------------------------------------------------------


class ScenarioKind(str, Enum):
    COLLAPSED_BUILDING = "collapsed_building"
    CAVE_TUNNEL = "cave_tunnel"
    FLOOD = "flood"
    WILDFIRE = "wildfire"
    INDUSTRIAL = "industrial"
    FOREST = "forest"
    NIGHT = "night"
    INDOOR = "indoor"
    PERIMETER = "perimeter"
    TRIAGE = "triage"


class MissionPhase(str, Enum):
    INIT = "init"
    DISCOVERY = "discovery"
    SEARCH = "search"
    TRIAGE = "triage"
    RESCUE = "rescue"
    EXTRACT = "extract"
    RETURN = "return"
    COMPLETE = "complete"
    ABORTED = "aborted"


class NodeRole(str, Enum):
    EXPLORER = "explorer"
    RELAY = "relay"
    TRIAGE = "triage"
    RESCUER = "rescuer"
    STANDBY = "standby"
    COMMAND = "command"
    SENSOR = "sensor"
    TRANSPORT = "transport"
    EMERGENCY = "emergency"


class EventType(str, Enum):
    MISSION_CREATED = "mission_created"
    MISSION_PHASE = "mission_phase"
    NODE_JOINED = "node_joined"
    NODE_LEFT = "node_left"
    NODE_ROLE = "node_role"
    TELEMETRY = "telemetry"
    SENSOR = "sensor"
    TARGET_FOUND = "target_found"
    TARGET_CONFIRMED = "target_confirmed"
    TARGET_ASSIGNED = "target_assigned"
    TARGET_EXTRACTED = "target_extracted"
    SAFETY_ALERT = "safety_alert"
    CHECKPOINT = "checkpoint"
    SYNC = "sync"
    CONSENSUS = "consensus"
    COMMAND = "command"
    COMMAND_ACK = "command_ack"
    HEARTBEAT = "heartbeat"
    FAILURE = "failure"
    RECOVERY = "recovery"
    GEOLOCK = "geolock"
    GEOUNLOCK = "geounlock"


class TelemetryQuality(str, Enum):
    GOOD = "good"
    DEGRADED = "degraded"
    LOST = "lost"
    UNKNOWN = "unknown"


class EnvelopeKind(str, Enum):
    """P2P envelope kind strings used with FoxMQ payloads."""

    HELLO = "hello"
    GOODBYE = "goodbye"
    HEARTBEAT = "heartbeat"
    STATE = "state"
    DELTA = "delta"
    TELEMETRY = "telemetry"
    SENSOR = "sensor"
    ROLE = "role"
    TASK = "task"
    TASK_BID = "task_bid"
    TASK_COMMIT = "task_commit"
    SAFETY = "safety"
    ALERT = "alert"
    COMMAND = "command"
    COMMAND_RESULT = "command_result"
    METRICS = "metrics"
    GOSSIP = "gossip"
    SYNC_HINT = "sync_hint"
    GEOFENCE = "geofence"


# ---------------------------------------------------------------------------
# Primitive data models
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class NodeIdentity:
    node_id: str
    display_name: str
    public_key: str
    secret_key: str
    vendor: str = "unknown"
    model: str = "generic"
    serial: str = ""
    created_at_ms: int = field(default_factory=now_ms)

    @classmethod
    def generate(cls, node_id: str, display_name: Optional[str] = None, *, vendor: str = "unknown", model: str = "generic") -> "NodeIdentity":
        secret = os.urandom(32)
        pub = hashlib.sha256(secret).hexdigest()
        return cls(
            node_id=node_id,
            display_name=display_name or node_id,
            public_key=pub,
            secret_key=base64.b64encode(secret).decode("ascii"),
            vendor=vendor,
            model=model,
            serial=f"{vendor}-{model}-{node_id}",
        )

    def secret_bytes(self) -> bytes:
        return base64.b64decode(self.secret_key.encode("ascii"))


@dataclass(slots=True)
class NodeEndpoint:
    host: str
    port: int
    scheme: str = "mqtt"

    def uri(self) -> str:
        return f"{self.scheme}://{self.host}:{self.port}"


@dataclass(slots=True)
class PeerInfo:
    node_id: str
    display_name: str
    public_key: str
    endpoint: Optional[NodeEndpoint] = None
    role: NodeRole = NodeRole.STANDBY
    last_seen_ms: int = field(default_factory=now_ms)
    first_seen_ms: int = field(default_factory=now_ms)
    heartbeat_interval_ms: int = 2000
    battery_pct: float = 100.0
    cpu_pct: float = 0.0
    memory_pct: float = 0.0
    mission_id: str = ""
    link_quality: float = 1.0
    trust_score: float = 1.0
    capabilities: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def touch(
        self,
        *,
        battery_pct: Optional[float] = None,
        cpu_pct: Optional[float] = None,
        memory_pct: Optional[float] = None,
        mission_id: Optional[str] = None,
        link_quality: Optional[float] = None,
        trust_score: Optional[float] = None,
    ) -> None:
        self.last_seen_ms = now_ms()
        if battery_pct is not None:
            self.battery_pct = battery_pct
        if cpu_pct is not None:
            self.cpu_pct = cpu_pct
        if memory_pct is not None:
            self.memory_pct = memory_pct
        if mission_id is not None:
            self.mission_id = mission_id
        if link_quality is not None:
            self.link_quality = link_quality
        if trust_score is not None:
            self.trust_score = trust_score

    def age_s(self) -> float:
        return max(0.0, (now_ms() - self.last_seen_ms) / 1000.0)


@dataclass(slots=True)
class GeoPoint:
    x: float
    y: float
    z: float = 0.0

    def to_dict(self) -> Dict[str, float]:
        return {"x": self.x, "y": self.y, "z": self.z}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GeoPoint":
        return cls(x=float(data.get("x", 0.0)), y=float(data.get("y", 0.0)), z=float(data.get("z", 0.0)))


@dataclass(slots=True)
class BatteryState:
    pct: float = 100.0
    voltage: float = 0.0
    temperature_c: float = 0.0
    current_a: float = 0.0
    charging: bool = False
    critical: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class TelemetryFrame:
    node_id: str
    timestamp_ms: int = field(default_factory=now_ms)
    position: GeoPoint = field(default_factory=lambda: GeoPoint(0.0, 0.0, 0.0))
    velocity: GeoPoint = field(default_factory=lambda: GeoPoint(0.0, 0.0, 0.0))
    battery: BatteryState = field(default_factory=BatteryState)
    role: NodeRole = NodeRole.STANDBY
    phase: MissionPhase = MissionPhase.INIT
    mission_id: str = ""
    cpu_pct: float = 0.0
    memory_pct: float = 0.0
    link_quality: float = 1.0
    gps_fix: bool = True
    heading_deg: float = 0.0
    altitude_m: float = 0.0
    target_id: Optional[str] = None
    sensor_flags: Dict[str, Any] = field(default_factory=dict)
    extras: Dict[str, Any] = field(default_factory=dict)

    def speed_mps(self) -> float:
        return math.sqrt(self.velocity.x ** 2 + self.velocity.y ** 2 + self.velocity.z ** 2)

    def quality(self) -> TelemetryQuality:
        score = 1.0
        if self.link_quality < 0.2:
            score -= 0.4
        if self.battery.pct < 15:
            score -= 0.25
        if self.cpu_pct > 85:
            score -= 0.15
        if self.memory_pct > 85:
            score -= 0.15
        if not self.gps_fix:
            score -= 0.1
        if score >= 0.8:
            return TelemetryQuality.GOOD
        if score >= 0.5:
            return TelemetryQuality.DEGRADED
        if score > 0:
            return TelemetryQuality.LOST
        return TelemetryQuality.UNKNOWN

    def to_dict(self) -> Dict[str, Any]:
        return {
            "node_id": self.node_id,
            "timestamp_ms": self.timestamp_ms,
            "position": self.position.to_dict(),
            "velocity": self.velocity.to_dict(),
            "battery": self.battery.to_dict(),
            "role": self.role.value,
            "phase": self.phase.value,
            "mission_id": self.mission_id,
            "cpu_pct": self.cpu_pct,
            "memory_pct": self.memory_pct,
            "link_quality": self.link_quality,
            "gps_fix": self.gps_fix,
            "heading_deg": self.heading_deg,
            "altitude_m": self.altitude_m,
            "target_id": self.target_id,
            "sensor_flags": dict(self.sensor_flags),
            "extras": dict(self.extras),
            "quality": self.quality().value,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TelemetryFrame":
        return cls(
            node_id=str(data.get("node_id", "")),
            timestamp_ms=int(data.get("timestamp_ms", now_ms())),
            position=GeoPoint.from_dict(data.get("position", {})),
            velocity=GeoPoint.from_dict(data.get("velocity", {})),
            battery=BatteryState(**data.get("battery", {})),
            role=NodeRole(str(data.get("role", NodeRole.STANDBY.value))),
            phase=MissionPhase(str(data.get("phase", MissionPhase.INIT.value))),
            mission_id=str(data.get("mission_id", "")),
            cpu_pct=float(data.get("cpu_pct", 0.0)),
            memory_pct=float(data.get("memory_pct", 0.0)),
            link_quality=float(data.get("link_quality", 1.0)),
            gps_fix=bool(data.get("gps_fix", True)),
            heading_deg=float(data.get("heading_deg", 0.0)),
            altitude_m=float(data.get("altitude_m", 0.0)),
            target_id=data.get("target_id"),
            sensor_flags=dict(data.get("sensor_flags", {})),
            extras=dict(data.get("extras", {})),
        )


@dataclass(slots=True)
class SensorReading:
    reading_id: str
    node_id: str
    sensor_type: str
    value: Any
    unit: str = ""
    confidence: float = 1.0
    timestamp_ms: int = field(default_factory=now_ms)
    location: Optional[GeoPoint] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        if self.location is not None:
            payload["location"] = self.location.to_dict()
        return payload

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SensorReading":
        location = data.get("location")
        return cls(
            reading_id=str(data.get("reading_id", f"read-{random.getrandbits(32):08x}")),
            node_id=str(data.get("node_id", "")),
            sensor_type=str(data.get("sensor_type", "generic")),
            value=data.get("value"),
            unit=str(data.get("unit", "")),
            confidence=float(data.get("confidence", 1.0)),
            timestamp_ms=int(data.get("timestamp_ms", now_ms())),
            location=GeoPoint.from_dict(location) if isinstance(location, dict) else None,
            metadata=dict(data.get("metadata", {})),
        )


@dataclass(slots=True)
class SafetyEvent:
    event_id: str
    node_id: str
    severity: str
    reason: str
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp_ms: int = field(default_factory=now_ms)
    position: Optional[GeoPoint] = None
    resolved: bool = False
    resolved_at_ms: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        if self.position is not None:
            payload["position"] = self.position.to_dict()
        return payload


@dataclass(slots=True)
class RescueTarget:
    target_id: str
    target_type: str
    priority: int = 0
    confidence: float = 0.0
    position: Optional[GeoPoint] = None
    discovered_by: Optional[str] = None
    assigned_to: Optional[str] = None
    extracted_by: Optional[str] = None
    status: str = "new"
    last_seen_ms: int = field(default_factory=now_ms)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        if self.position is not None:
            payload["position"] = self.position.to_dict()
        return payload


@dataclass(slots=True)
class MissionCheckpoint:
    checkpoint_id: str
    mission_id: str
    phase: MissionPhase
    version: int
    state_hash: str
    created_at_ms: int = field(default_factory=now_ms)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class CommandRequest:
    command_id: str
    requester_id: str
    target_id: str
    command: str
    args: Dict[str, Any] = field(default_factory=dict)
    ttl: int = 3
    expect_ack: bool = True
    timestamp_ms: int = field(default_factory=now_ms)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_payload(cls, data: Dict[str, Any]) -> "CommandRequest":
        return cls(
            command_id=str(data.get("command_id", "")),
            requester_id=str(data.get("requester_id", "")),
            target_id=str(data.get("target_id", "")),
            command=str(data.get("command", "")),
            args=dict(data.get("args", {})),
            ttl=int(data.get("ttl", 3)),
            expect_ack=bool(data.get("expect_ack", True)),
            timestamp_ms=int(data.get("timestamp_ms", now_ms())),
        )


@dataclass(slots=True)
class CommandResult:
    command_id: str
    ok: bool
    result: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    timestamp_ms: int = field(default_factory=now_ms)

    @classmethod
    def from_payload(cls, data: Dict[str, Any]) -> "CommandResult":
        return cls(
            command_id=str(data.get("command_id", "")),
            ok=bool(data.get("ok", False)),
            result=dict(data.get("result", {})),
            error=data.get("error"),
            timestamp_ms=int(data.get("timestamp_ms", now_ms())),
        )


# ---------------------------------------------------------------------------
# Storage and crypto
# ---------------------------------------------------------------------------


class JSONFileStore:
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
            LOG.exception("failed to load JSON store: %s", self.path)
            return default.copy()

    def save(self, data: Dict[str, Any]) -> None:
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        with self._lock:
            tmp.write_text(json_dump(data), encoding="utf-8")
            tmp.replace(self.path)


class SecretKeyring:
    def __init__(self, secret_path: Path) -> None:
        self.secret_path = Path(secret_path)
        self.secret_path.parent.mkdir(parents=True, exist_ok=True)
        self._secret = self._load_or_create()

    def _load_or_create(self) -> bytes:
        if self.secret_path.exists():
            raw = self.secret_path.read_text(encoding="utf-8").strip()
            try:
                return bytes.fromhex(raw)
            except Exception:
                pass
        secret = os.urandom(32)
        self.secret_path.write_text(secret.hex(), encoding="utf-8")
        return secret

    @property
    def secret(self) -> bytes:
        return self._secret


class EnvelopeSigner:
    def __init__(self, secret: bytes) -> None:
        self.secret = secret

    def sign(self, payload: str) -> str:
        return hmac.new(self.secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()

    def verify(self, payload: str, signature: str) -> bool:
        return hmac.compare_digest(self.sign(payload), signature)


# ---------------------------------------------------------------------------
# Immutable mission ledger
# ---------------------------------------------------------------------------


def _ledger_entry_from_dict(item: Dict[str, Any]) -> "LedgerEntry":
    row = dict(item)
    row["event_type"] = EventType(str(row.get("event_type", EventType.MISSION_CREATED.value)))
    return LedgerEntry(**row)


@dataclass(slots=True)
class LedgerEntry:
    entry_id: str
    mission_id: str
    event_type: EventType
    actor_id: str
    payload: Dict[str, Any]
    previous_hash: str
    timestamp_ms: int = field(default_factory=now_ms)
    signature: str = ""
    nonce: str = field(default_factory=lambda: f"n{random.getrandbits(64):016x}")
    block_index: int = 0
    cumulative_hash: str = ""

    def body(self) -> Dict[str, Any]:
        return {
            "entry_id": self.entry_id,
            "mission_id": self.mission_id,
            "event_type": self.event_type.value,
            "actor_id": self.actor_id,
            "payload": self.payload,
            "previous_hash": self.previous_hash,
            "timestamp_ms": self.timestamp_ms,
            "nonce": self.nonce,
            "block_index": self.block_index,
        }

    def hash(self) -> str:
        return stable_hash(self.body())


class MissionLedger:
    """Append-only ledger for mission events.

    This is blockchain-like without trying to be a public chain. It is used for
    deterministic ordering, replay, recovery, and audit.
    """

    def __init__(self, store: JSONFileStore, signer: Optional[EnvelopeSigner] = None) -> None:
        self.store = store
        self.signer = signer
        self._lock = threading.RLock()
        self._entries: List[LedgerEntry] = []
        self._load()

    def _load(self) -> None:
        data = self.store.load({"ledger": []})
        with self._lock:
            self._entries = [_ledger_entry_from_dict(item) for item in data.get("ledger", [])]

    def _persist(self) -> None:
        with self._lock:
            payload = {"ledger": [asdict(entry) for entry in self._entries]}
        self.store.save(payload)

    def head_hash(self) -> str:
        with self._lock:
            return self._entries[-1].hash() if self._entries else "genesis"

    def append(self, mission_id: str, event_type: EventType, actor_id: str, payload: Dict[str, Any]) -> LedgerEntry:
        with self._lock:
            previous = self._entries[-1].hash() if self._entries else "genesis"
            entry = LedgerEntry(
                entry_id=f"evt-{random.getrandbits(48):012x}",
                mission_id=mission_id,
                event_type=event_type,
                actor_id=actor_id,
                payload=payload,
                previous_hash=previous,
                block_index=len(self._entries),
            )
            raw = json.dumps(entry.body(), sort_keys=True, separators=(",", ":"))
            if self.signer is not None:
                entry.signature = self.signer.sign(raw)
            entry.cumulative_hash = entry.hash()
            self._entries.append(entry)
        self._persist()
        return entry

    def verify(self) -> Tuple[bool, str]:
        with self._lock:
            previous = "genesis"
            for idx, entry in enumerate(self._entries):
                if entry.block_index != idx:
                    return False, f"bad_block_index:{idx}"
                if entry.previous_hash != previous:
                    return False, f"bad_previous_hash:{idx}"
                if entry.cumulative_hash != entry.hash():
                    return False, f"bad_entry_hash:{idx}"
                previous = entry.hash()
        return True, "ok"

    def entries(self, mission_id: Optional[str] = None) -> List[LedgerEntry]:
        with self._lock:
            if mission_id is None:
                return list(self._entries)
            return [entry for entry in self._entries if entry.mission_id == mission_id]

    def last_for(self, mission_id: str) -> Optional[LedgerEntry]:
        with self._lock:
            for entry in reversed(self._entries):
                if entry.mission_id == mission_id:
                    return entry
        return None

    def tail(self, limit: int = 100) -> List[Dict[str, Any]]:
        with self._lock:
            return [asdict(e) for e in self._entries[-limit:]]


# ---------------------------------------------------------------------------
# Consensus and Vertex adapter abstractions
# ---------------------------------------------------------------------------


class ConsensusKind(str, Enum):
    ROLE_CHANGE = "role_change"
    SAFETY_COMMIT = "safety_commit"
    TARGET_COMMIT = "target_commit"
    MAP_COMMIT = "map_commit"
    COMMAND_ORDER = "command_order"
    REPLAY_PROOF = "replay_proof"
    CHECKPOINT = "checkpoint"


class ConsensusEngine(Protocol):
    def submit(self, kind: ConsensusKind, payload: Dict[str, Any]) -> Dict[str, Any]: ...
    def broadcast(self, topic: str, payload: Dict[str, Any]) -> None: ...
    def peers(self) -> List[str]: ...


class MockVertexConsensusEngine:
    """Testable consensus stand-in.

    Real Vertex integration should keep the same API surface: submit consensus
    objects, read the ordered output, and react to peer membership.
    """

    def __init__(self, node_id: str) -> None:
        self.node_id = node_id
        self._lock = threading.RLock()
        self._sequence = 0
        self._peers: Set[str] = set()
        self._log: List[Dict[str, Any]] = []

    def submit(self, kind: ConsensusKind, payload: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            self._sequence += 1
            record = {
                "sequence": self._sequence,
                "kind": kind.value,
                "payload": payload,
                "node_id": self.node_id,
                "ts_ms": now_ms(),
            }
            self._log.append(record)
            return record

    def broadcast(self, topic: str, payload: Dict[str, Any]) -> None:
        with self._lock:
            self._log.append({"topic": topic, "payload": payload, "ts_ms": now_ms()})

    def peers(self) -> List[str]:
        with self._lock:
            return sorted(self._peers)

    def add_peer(self, peer_id: str) -> None:
        with self._lock:
            self._peers.add(peer_id)


# ---------------------------------------------------------------------------
# FoxMQ transport abstractions
# ---------------------------------------------------------------------------


class FoxMQTransport(Protocol):
    def publish(self, topic: str, payload: str, qos: int = 2, retain: bool = False) -> Any: ...
    def subscribe(self, topic: str, qos: int = 2) -> Any: ...
    def connect(self) -> None: ...
    def disconnect(self) -> None: ...


class MockFoxMQBus:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._handlers: DefaultDict[str, List[Callable[[str, str], None]]] = defaultdict(list)
        self._published: List[Tuple[str, str, int, bool]] = []

    def publish(self, topic: str, payload: str, qos: int = 2, retain: bool = False) -> Any:
        with self._lock:
            self._published.append((topic, payload, qos, retain))
            handlers = list(self._handlers.get(topic, []))
        for handler in handlers:
            try:
                handler(topic, payload)
            except Exception:
                LOG.exception("mock foxmq handler failed")
        return {"ok": True, "topic": topic}

    def subscribe(self, topic: str, qos: int = 2) -> Any:
        return {"ok": True, "topic": topic, "qos": qos}

    def connect(self) -> None:
        return None

    def disconnect(self) -> None:
        return None

    def on(self, topic: str, handler: Callable[[str, str], None]) -> None:
        with self._lock:
            self._handlers[topic].append(handler)

    def published(self) -> List[Tuple[str, str, int, bool]]:
        with self._lock:
            return list(self._published)


# ---------------------------------------------------------------------------
# Topic layout
# ---------------------------------------------------------------------------


class TopicLayout:
    def __init__(self, swarm_id: str) -> None:
        self.swarm_id = swarm_id

    def base(self) -> str:
        return f"swarm/{self.swarm_id}"

    def discovery(self) -> str:
        return f"{self.base()}/discovery"

    def peer(self, node_id: str) -> str:
        return f"{self.base()}/peer/{node_id}"

    def telemetry(self, node_id: str) -> str:
        return f"{self.base()}/telemetry/{node_id}"

    def sensor(self, node_id: str) -> str:
        return f"{self.base()}/sensor/{node_id}"

    def state(self) -> str:
        return f"{self.base()}/state"

    def delta(self) -> str:
        return f"{self.base()}/state/delta"

    def role(self) -> str:
        return f"{self.base()}/role"

    def task(self) -> str:
        return f"{self.base()}/task"

    def task_bid(self) -> str:
        return f"{self.base()}/task/bid"

    def task_commit(self) -> str:
        return f"{self.base()}/task/commit"

    def safety(self) -> str:
        return f"{self.base()}/safety"

    def alert(self) -> str:
        return f"{self.base()}/alert"

    def command(self, target_id: str) -> str:
        return f"{self.base()}/command/{target_id}"

    def command_result(self, node_id: str) -> str:
        return f"{self.base()}/command/result/{node_id}"

    def metrics(self) -> str:
        return f"{self.base()}/metrics"

    def gossip(self) -> str:
        return f"{self.base()}/gossip"


# ---------------------------------------------------------------------------
# Dedupe / envelopes / signing
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class P2PEnvelope:
    message_id: str
    kind: str
    sender_id: str
    topic: str
    payload: Dict[str, Any]
    timestamp_ms: int = field(default_factory=now_ms)
    ttl: int = 4
    seq: int = 0
    correlation_id: Optional[str] = None
    reply_to: Optional[str] = None
    signature: Optional[str] = None

    def to_json(self) -> str:
        return json.dumps(asdict(self), sort_keys=True, separators=(",", ":"))

    @classmethod
    def from_json(cls, raw: str) -> "P2PEnvelope":
        data = json.loads(raw)
        return cls(
            message_id=str(data["message_id"]),
            kind=str(data["kind"]),
            sender_id=str(data["sender_id"]),
            topic=str(data["topic"]),
            payload=dict(data.get("payload", {})),
            timestamp_ms=int(data.get("timestamp_ms", now_ms())),
            ttl=int(data.get("ttl", 4)),
            seq=int(data.get("seq", 0)),
            correlation_id=data.get("correlation_id"),
            reply_to=data.get("reply_to"),
            signature=data.get("signature"),
        )


class DedupeCache:
    def __init__(self, ttl_s: float = 60.0, max_items: int = 4096) -> None:
        self.ttl_s = ttl_s
        self.max_items = max_items
        self._lock = threading.RLock()
        self._items: Dict[str, float] = {}

    def seen(self, message_id: str) -> bool:
        now = time.time()
        with self._lock:
            self._purge(now)
            if message_id in self._items:
                return True
            self._items[message_id] = now
            if len(self._items) > self.max_items:
                for key in sorted(self._items.keys(), key=lambda k: self._items[k])[: len(self._items) - self.max_items]:
                    self._items.pop(key, None)
            return False

    def _purge(self, now: float) -> None:
        stale = [k for k, ts in self._items.items() if now - ts > self.ttl_s]
        for key in stale:
            self._items.pop(key, None)


class P2PSigner:
    def __init__(self, secret: bytes) -> None:
        self.secret = secret

    def sign(self, envelope: P2PEnvelope) -> str:
        return hmac.new(self.secret, canonical_p2p_envelope_json(envelope).encode("utf-8"), hashlib.sha256).hexdigest()

    def verify(self, envelope: P2PEnvelope, signature: str) -> bool:
        return hmac.compare_digest(self.sign(envelope), signature)


# ---------------------------------------------------------------------------
# World map and grid state
# ---------------------------------------------------------------------------


class CellState(str, Enum):
    UNKNOWN = "unknown"
    FRONTIER = "frontier"
    SEEN = "seen"
    SEARCHED = "searched"
    BLOCKED = "blocked"
    TARGET = "target"
    SAFE = "safe"


@dataclass(slots=True)
class WorldCell:
    cell_id: str
    x: int
    y: int
    z: int = 0
    state: CellState = CellState.UNKNOWN
    confidence: float = 0.0
    owner: Optional[str] = None
    cost: float = 1.0
    last_seen_ms: int = field(default_factory=now_ms)
    version: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def touch(
        self,
        *,
        state: Optional[CellState] = None,
        owner: Optional[str] = None,
        confidence: Optional[float] = None,
        cost: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.last_seen_ms = now_ms()
        self.version += 1
        if state is not None:
            self.state = state
        if owner is not None:
            self.owner = owner
        if confidence is not None:
            self.confidence = clamp(confidence, 0.0, 1.0)
        if cost is not None:
            self.cost = max(0.0, float(cost))
        if metadata:
            self.metadata.update(metadata)

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["state"] = self.state.value
        return payload

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WorldCell":
        return cls(
            cell_id=str(data.get("cell_id", f"{data.get('x', 0)}:{data.get('y', 0)}:{data.get('z', 0)}")),
            x=int(data.get("x", 0)),
            y=int(data.get("y", 0)),
            z=int(data.get("z", 0)),
            state=CellState(str(data.get("state", CellState.UNKNOWN.value))),
            confidence=float(data.get("confidence", 0.0)),
            owner=data.get("owner"),
            cost=float(data.get("cost", 1.0)),
            last_seen_ms=int(data.get("last_seen_ms", now_ms())),
            version=int(data.get("version", 0)),
            metadata=dict(data.get("metadata", {})),
        )


@dataclass(slots=True)
class SharedMapSnapshot:
    map_id: str
    version: int
    updated_at_ms: int
    cells: Dict[str, Dict[str, Any]]
    explored_count: int
    blocked_count: int
    target_count: int
    frontier_count: int
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class SharedMapDelta:
    delta_id: str
    map_id: str
    base_version: int
    cells: List[Dict[str, Any]]
    created_at_ms: int = field(default_factory=now_ms)
    source_node_id: str = ""
    reason: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SharedWorldMap:
    def __init__(self, map_id: str, store: JSONFileStore) -> None:
        self.map_id = map_id
        self.store = store
        self._lock = threading.RLock()
        self._version = 0
        self._cells: Dict[str, WorldCell] = {}
        self._dirty: Set[str] = set()
        self._load()

    def _load(self) -> None:
        data = self.store.load({"map_id": self.map_id, "cells": {}})
        with self._lock:
            self._version = int(data.get("version", 0))
            for cell_id, payload in data.get("cells", {}).items():
                self._cells[cell_id] = WorldCell.from_dict(payload)

    def persist(self) -> None:
        with self._lock:
            payload = {
                "map_id": self.map_id,
                "version": self._version,
                "updated_at_ms": now_ms(),
                "cells": {cell_id: cell.to_dict() for cell_id, cell in self._cells.items()},
            }
        self.store.save(payload)

    @property
    def version(self) -> int:
        with self._lock:
            return self._version

    def _bump(self) -> None:
        self._version += 1

    def get_cell(self, cell_id: str) -> Optional[WorldCell]:
        with self._lock:
            return self._cells.get(cell_id)

    def upsert(self, cell: WorldCell) -> bool:
        with self._lock:
            current = self._cells.get(cell.cell_id)
            if current is None or cell.version > current.version or (cell.version == current.version and cell.last_seen_ms >= current.last_seen_ms):
                self._cells[cell.cell_id] = cell
                self._dirty.add(cell.cell_id)
                self._bump()
                self.persist()
                return True
            return False

    def mark(
        self,
        x: int,
        y: int,
        z: int = 0,
        *,
        state: CellState,
        owner: Optional[str] = None,
        confidence: float = 0.5,
        cost: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> WorldCell:
        cell_id = f"{x}:{y}:{z}"
        with self._lock:
            cell = self._cells.get(cell_id)
            if cell is None:
                cell = WorldCell(cell_id=cell_id, x=x, y=y, z=z, state=state, confidence=confidence, owner=owner, cost=cost, metadata=metadata or {})
                self._cells[cell_id] = cell
            else:
                cell.touch(state=state, owner=owner or cell.owner, confidence=max(cell.confidence, confidence), cost=cost, metadata=metadata)
            self._dirty.add(cell_id)
            self._bump()
        self.persist()
        return cell

    def mark_seen(self, x: int, y: int, z: int = 0, *, owner: Optional[str] = None, confidence: float = 0.6, cost: float = 1.0, metadata: Optional[Dict[str, Any]] = None) -> WorldCell:
        return self.mark(x, y, z, state=CellState.SEEN, owner=owner, confidence=confidence, cost=cost, metadata=metadata)

    def mark_searched(self, x: int, y: int, z: int = 0, *, owner: Optional[str] = None, confidence: float = 0.9) -> WorldCell:
        return self.mark(x, y, z, state=CellState.SEARCHED, owner=owner, confidence=confidence)

    def mark_blocked(self, x: int, y: int, z: int = 0, *, owner: Optional[str] = None, reason: str = "") -> WorldCell:
        return self.mark(x, y, z, state=CellState.BLOCKED, owner=owner, confidence=1.0, metadata={"reason": reason})

    def mark_target(self, x: int, y: int, z: int = 0, *, owner: Optional[str] = None, target_type: str = "victim", confidence: float = 1.0) -> WorldCell:
        return self.mark(x, y, z, state=CellState.TARGET, owner=owner, confidence=confidence, metadata={"target_type": target_type})

    def merge(self, remote_cells: Sequence[Dict[str, Any]], *, source_version: int = 0, source_node_id: str = "") -> Dict[str, int]:
        stats = {"inserted": 0, "updated": 0, "ignored": 0}
        with self._lock:
            for payload in remote_cells:
                remote = WorldCell.from_dict(payload)
                current = self._cells.get(remote.cell_id)
                if current is None:
                    self._cells[remote.cell_id] = remote
                    self._dirty.add(remote.cell_id)
                    stats["inserted"] += 1
                elif remote.version > current.version or (remote.version == current.version and remote.last_seen_ms >= current.last_seen_ms):
                    self._cells[remote.cell_id] = remote
                    self._dirty.add(remote.cell_id)
                    stats["updated"] += 1
                else:
                    stats["ignored"] += 1
            if source_version > self._version:
                self._version = source_version
            self._bump()
        self.persist()
        return stats

    def delta(self, *, max_cells: int = 200) -> SharedMapDelta:
        with self._lock:
            dirty_ids = list(self._dirty)[:max_cells]
            cells = [self._cells[cell_id].to_dict() for cell_id in dirty_ids if cell_id in self._cells]
            self._dirty.difference_update(dirty_ids)
            delta = SharedMapDelta(
                delta_id=f"delta-{random.getrandbits(32):08x}",
                map_id=self.map_id,
                base_version=self._version,
                cells=cells,
                source_node_id="local",
                reason="dirty_sync",
                metadata={"dirty_count": len(self._dirty)},
            )
        self.persist()
        return delta

    def snapshot(self) -> SharedMapSnapshot:
        with self._lock:
            cells = {cell_id: cell.to_dict() for cell_id, cell in self._cells.items()}
            explored = sum(1 for c in self._cells.values() if c.state in {CellState.SEEN, CellState.SEARCHED, CellState.TARGET, CellState.BLOCKED})
            blocked = sum(1 for c in self._cells.values() if c.state == CellState.BLOCKED)
            target = sum(1 for c in self._cells.values() if c.state == CellState.TARGET)
            frontier = sum(1 for c in self._cells.values() if c.state == CellState.FRONTIER)
            return SharedMapSnapshot(self.map_id, self._version, now_ms(), cells, explored, blocked, target, frontier, {"dirty": len(self._dirty)})

    def dirty_count(self) -> int:
        with self._lock:
            return len(self._dirty)

    def frontier_cells(self) -> List[WorldCell]:
        with self._lock:
            return [cell for cell in self._cells.values() if cell.state == CellState.FRONTIER]

    def all_cells(self) -> List[WorldCell]:
        with self._lock:
            return list(self._cells.values())

    def summary(self) -> Dict[str, Any]:
        snap = self.snapshot()
        return {
            "map_id": snap.map_id,
            "version": snap.version,
            "cells": len(snap.cells),
            "explored_count": snap.explored_count,
            "blocked_count": snap.blocked_count,
            "target_count": snap.target_count,
            "frontier_count": snap.frontier_count,
            "dirty_count": snap.metadata.get("dirty", 0),
        }


# ---------------------------------------------------------------------------
# Tasks and allocation
# ---------------------------------------------------------------------------


class TaskStatus(str, Enum):
    OPEN = "open"
    BIDDING = "bidding"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"
    ABORTED = "aborted"


@dataclass(slots=True)
class TaskBid:
    task_id: str
    bidder_id: str
    score: float
    eta_ms: int
    resources: Dict[str, Any] = field(default_factory=dict)
    notes: Dict[str, Any] = field(default_factory=dict)
    timestamp_ms: int = field(default_factory=now_ms)


@dataclass(slots=True)
class MissionTask:
    task_id: str
    mission_id: str
    task_type: str
    requirements: Dict[str, Any]
    proposer_id: str
    status: TaskStatus = TaskStatus.OPEN
    bids: List[TaskBid] = field(default_factory=list)
    winner_id: Optional[str] = None
    created_at_ms: int = field(default_factory=now_ms)
    closes_at_ms: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_bid(self, bid: TaskBid) -> None:
        if self.status in {TaskStatus.COMPLETE, TaskStatus.ABORTED}:
            return
        self.bids.append(bid)
        self.status = TaskStatus.BIDDING

    def best_bid(self) -> Optional[TaskBid]:
        if not self.bids:
            return None
        self.bids.sort(key=lambda b: (b.score, -b.eta_ms, b.bidder_id), reverse=True)
        return self.bids[0]


class TaskBoard:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._tasks: Dict[str, MissionTask] = {}

    def propose(self, task_id: str, mission_id: str, task_type: str, requirements: Dict[str, Any], proposer_id: str, *, closes_in_s: int = 30) -> MissionTask:
        task = MissionTask(task_id=task_id, mission_id=mission_id, task_type=task_type, requirements=requirements, proposer_id=proposer_id, closes_at_ms=now_ms() + closes_in_s * 1000)
        with self._lock:
            self._tasks[task_id] = task
        return task

    def add_bid(self, bid: TaskBid) -> None:
        with self._lock:
            task = self._tasks.get(bid.task_id)
            if task is None:
                task = MissionTask(task_id=bid.task_id, mission_id="", task_type="generic", requirements={}, proposer_id=bid.bidder_id)
                self._tasks[bid.task_id] = task
            task.add_bid(bid)

    def assign_best(self, task_id: str) -> Optional[MissionTask]:
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                return None
            best = task.best_bid()
            if best is None:
                return None
            task.winner_id = best.bidder_id
            task.status = TaskStatus.ASSIGNED
            return task

    def complete(self, task_id: str) -> Optional[MissionTask]:
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                return None
            task.status = TaskStatus.COMPLETE
            return task

    def abort(self, task_id: str, reason: str = "") -> Optional[MissionTask]:
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                return None
            task.status = TaskStatus.ABORTED
            task.metadata["abort_reason"] = reason
            return task

    def get(self, task_id: str) -> Optional[MissionTask]:
        with self._lock:
            return self._tasks.get(task_id)

    def all(self) -> List[MissionTask]:
        with self._lock:
            return list(self._tasks.values())

    def expire(self) -> List[str]:
        now = now_ms()
        expired: List[str] = []
        with self._lock:
            for task_id, task in list(self._tasks.items()):
                if task.closes_at_ms and now >= task.closes_at_ms and task.status not in {TaskStatus.COMPLETE, TaskStatus.ABORTED}:
                    expired.append(task_id)
                    task.status = TaskStatus.ABORTED
        return expired


# ---------------------------------------------------------------------------
# Safety and geofencing
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class GeoFence:
    fence_id: str
    name: str
    points: List[GeoPoint]
    min_alt_m: float = 0.0
    max_alt_m: float = 120.0
    enabled: bool = True
    emergency_exit: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def contains(self, point: GeoPoint) -> bool:
        if point.z < self.min_alt_m or point.z > self.max_alt_m:
            return False
        if len(self.points) < 3:
            return True
        inside = False
        j = len(self.points) - 1
        for i in range(len(self.points)):
            xi, yi = self.points[i].x, self.points[i].y
            xj, yj = self.points[j].x, self.points[j].y
            intersect = ((yi > point.y) != (yj > point.y)) and (
                point.x < (xj - xi) * (point.y - yi) / ((yj - yi) if (yj - yi) != 0 else 1e-9) + xi
            )
            if intersect:
                inside = not inside
            j = i
        return inside

    def to_dict(self) -> Dict[str, Any]:
        return {
            "fence_id": self.fence_id,
            "name": self.name,
            "points": [p.to_dict() for p in self.points],
            "min_alt_m": self.min_alt_m,
            "max_alt_m": self.max_alt_m,
            "enabled": self.enabled,
            "emergency_exit": self.emergency_exit,
            "metadata": dict(self.metadata),
        }


class GeoFenceManager:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._fences: Dict[str, GeoFence] = {}

    def add(self, fence: GeoFence) -> None:
        with self._lock:
            self._fences[fence.fence_id] = fence

    def remove(self, fence_id: str) -> bool:
        with self._lock:
            return self._fences.pop(fence_id, None) is not None

    def list(self) -> List[GeoFence]:
        with self._lock:
            return list(self._fences.values())

    def check(self, point: GeoPoint) -> List[GeoFence]:
        return [fence for fence in self.list() if fence.enabled and not fence.contains(point)]


class SafetyLevel(str, Enum):
    OK = "ok"
    WARN = "warn"
    STOP = "stop"
    RTH = "return_home"
    EMERGENCY = "emergency"


class SafetyController:
    def __init__(self, geofences: GeoFenceManager) -> None:
        self.geofences = geofences
        self._lock = threading.RLock()
        self._events: Deque[SafetyEvent] = deque(maxlen=2000)

    def inspect(self, telemetry: TelemetryFrame) -> List[SafetyEvent]:
        events: List[SafetyEvent] = []
        if self.geofences.check(telemetry.position):
            events.append(
                SafetyEvent(
                    f"safe-{random.getrandbits(32):08x}",
                    telemetry.node_id,
                    SafetyLevel.STOP.value,
                    "geofence_violation",
                    {"mission_id": telemetry.mission_id},
                    telemetry.timestamp_ms,
                    telemetry.position,
                )
            )
        if telemetry.battery.critical or telemetry.battery.pct < 10:
            events.append(
                SafetyEvent(
                    f"safe-{random.getrandbits(32):08x}",
                    telemetry.node_id,
                    SafetyLevel.RTH.value,
                    "battery_low",
                    {"battery_pct": telemetry.battery.pct},
                    telemetry.timestamp_ms,
                    telemetry.position,
                )
            )
        if telemetry.battery.temperature_c > 80:
            events.append(
                SafetyEvent(
                    f"safe-{random.getrandbits(32):08x}",
                    telemetry.node_id,
                    SafetyLevel.EMERGENCY.value,
                    "temperature_high",
                    {"temperature_c": telemetry.battery.temperature_c},
                    telemetry.timestamp_ms,
                    telemetry.position,
                )
            )
        if telemetry.link_quality < 0.2:
            events.append(
                SafetyEvent(
                    f"safe-{random.getrandbits(32):08x}",
                    telemetry.node_id,
                    SafetyLevel.WARN.value,
                    "link_degraded",
                    {"link_quality": telemetry.link_quality},
                    telemetry.timestamp_ms,
                    telemetry.position,
                )
            )
        with self._lock:
            self._events.extend(events)
        return events

    def recent(self, limit: int = 100) -> List[Dict[str, Any]]:
        with self._lock:
            return [event.to_dict() for event in list(self._events)[-limit:]]


# ---------------------------------------------------------------------------
# Peer registry and liveness
# ---------------------------------------------------------------------------


class PeerRegistry:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._peers: Dict[str, PeerInfo] = {}

    def register(self, peer: PeerInfo) -> PeerInfo:
        with self._lock:
            current = self._peers.get(peer.node_id)
            if current is None or peer.last_seen_ms >= current.last_seen_ms:
                self._peers[peer.node_id] = peer
                return peer
            return current

    def remove(self, node_id: str) -> bool:
        with self._lock:
            return self._peers.pop(node_id, None) is not None

    def get(self, node_id: str) -> Optional[PeerInfo]:
        with self._lock:
            return self._peers.get(node_id)

    def all(self) -> List[PeerInfo]:
        with self._lock:
            return sorted(self._peers.values(), key=lambda p: (p.last_seen_ms, p.battery_pct), reverse=True)

    def active(self) -> List[PeerInfo]:
        return [peer for peer in self.all() if peer.age_s() < 15.0]

    def stale(self, threshold_s: float = 15.0) -> List[PeerInfo]:
        return [peer for peer in self.all() if peer.age_s() >= threshold_s]

    def summary(self) -> Dict[str, Any]:
        peers = self.all()
        return {
            "total": len(peers),
            "active": len(self.active()),
            "stale": len(self.stale()),
            "roles": dict((role.value, sum(1 for p in peers if p.role == role)) for role in NodeRole),
        }


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class MetricPoint:
    metric: str
    value: float
    timestamp_ms: int = field(default_factory=now_ms)
    labels: Dict[str, Any] = field(default_factory=dict)


class SwarmMetrics:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._counter: DefaultDict[str, float] = defaultdict(float)
        self._gauge: Dict[str, float] = {}
        self._latencies: DefaultDict[str, List[float]] = defaultdict(list)
        self._points: Deque[MetricPoint] = deque(maxlen=10000)

    def inc(self, metric: str, amount: float = 1.0, **labels: Any) -> None:
        with self._lock:
            self._counter[metric] += amount
            self._points.append(MetricPoint(metric, self._counter[metric], labels=labels))

    def gauge(self, metric: str, value: float, **labels: Any) -> None:
        with self._lock:
            self._gauge[metric] = value
            self._points.append(MetricPoint(metric, value, labels=labels))

    def observe(self, metric: str, value_ms: float, **labels: Any) -> None:
        with self._lock:
            self._latencies[metric].append(value_ms)
            self._points.append(MetricPoint(metric, value_ms, labels=labels))

    def summary(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "counters": dict(self._counter),
                "gauges": dict(self._gauge),
                "latency": {k: {"count": len(v), "avg_ms": (sum(v) / len(v)) if v else 0.0, "p95_ms": percentile(v, 95)} for k, v in self._latencies.items()},
                "recent_points": [asdict(p) for p in list(self._points)[-100:]],
            }

    def render_prometheus(self) -> str:
        with self._lock:
            lines = []
            for metric, value in self._counter.items():
                lines.append(f"vertexfox_{metric}_total {value}")
            for metric, value in self._gauge.items():
                lines.append(f"vertexfox_{metric} {value}")
            for metric, samples in self._latencies.items():
                lines.append(f"vertexfox_{metric}_avg_ms {(sum(samples) / len(samples)) if samples else 0.0}")
                lines.append(f"vertexfox_{metric}_p95_ms {percentile(samples, 95)}")
            return "\n".join(lines) + ("\n" if lines else "")


def percentile(values: Sequence[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = int(round((pct / 100.0) * (len(ordered) - 1)))
    idx = max(0, min(len(ordered) - 1, idx))
    return float(ordered[idx])


# ---------------------------------------------------------------------------
# Consensus-ordered event log and replay proof
# ---------------------------------------------------------------------------


class ReplayGuard:
    def __init__(self, window_s: float = 120.0) -> None:
        self.window_s = window_s
        self._lock = threading.RLock()
        self._recent: Dict[str, float] = {}

    def record(self, message_id: str) -> bool:
        now = time.time()
        with self._lock:
            self._purge(now)
            if message_id in self._recent:
                return False
            self._recent[message_id] = now
            return True

    def _purge(self, now: float) -> None:
        stale = [k for k, ts in self._recent.items() if now - ts > self.window_s]
        for key in stale:
            self._recent.pop(key, None)


# ---------------------------------------------------------------------------
# Event bus + map sync
# ---------------------------------------------------------------------------


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


class SharedMapSyncService:
    def __init__(self, foxmq: FoxMQTransport, world_map: SharedWorldMap, metrics: Optional[SwarmMetrics] = None) -> None:
        self.foxmq = foxmq
        self.world_map = world_map
        self.metrics = metrics
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return

        def _idle() -> None:
            while not self._stop.wait(30.0):
                pass

        self._thread = threading.Thread(target=_idle, daemon=True, name="sar-map-sync")
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=1.0)
            self._thread = None

    def request_sync(self, peer_id: Optional[str] = None) -> None:
        if self.metrics is not None:
            self.metrics.inc("map_sync_requests", peer=str(peer_id or ""))


def _envelope_kind_str(kind: Any) -> str:
    if isinstance(kind, EnvelopeKind):
        return kind.value
    return str(kind)


# ---------------------------------------------------------------------------
# Vertex + FoxMQ backend runtime
# ---------------------------------------------------------------------------


class VertexFoxMQBackend:
    """Core backend object.

    It intentionally keeps consensus-critical actions separate from messaging:
    - Vertex handles role decisions, ordered commits, and proofs.
    - FoxMQ handles pub/sub state propagation and live peer visibility.
    - The backend coordinates scenarios, missions, and recovery.
    """

    def __init__(
        self,
        *,
        swarm_id: str,
        identity: NodeIdentity,
        vertex: ConsensusEngine,
        foxmq: FoxMQTransport,
        persistence_dir: str | Path = ".vertexfox",
    ) -> None:
        self.swarm_id = swarm_id
        self.identity = identity
        self.vertex = vertex
        self.foxmq = foxmq
        self.layout = TopicLayout(swarm_id)
        self.persistence_dir = Path(persistence_dir)
        self.persistence_dir.mkdir(parents=True, exist_ok=True)
        self.store = JSONFileStore(self.persistence_dir / f"{swarm_id}.{identity.node_id}.json")
        self.signer = EnvelopeSigner(identity.secret_bytes())
        self.p2p_signer = P2PSigner(identity.secret_bytes())
        self.ledger = MissionLedger(JSONFileStore(self.persistence_dir / f"{swarm_id}.{identity.node_id}.ledger.json"), signer=self.signer)
        self.dedupe = DedupeCache()
        self.replay_guard = ReplayGuard()
        self.metrics = SwarmMetrics()
        self.peers = PeerRegistry()
        self.tasks = TaskBoard()
        self.geofences = GeoFenceManager()
        self.safety = SafetyController(self.geofences)
        self.world_map = SharedWorldMap(f"{swarm_id}-map", JSONFileStore(self.persistence_dir / f"{swarm_id}.{identity.node_id}.map.json"))
        self.map_sync = SharedMapSyncService(self.foxmq, self.world_map, self.metrics)
        self.consensus_log = JSONFileStore(self.persistence_dir / f"{swarm_id}.{identity.node_id}.consensus.json")
        self.events = EventBus()
        self._stop = threading.Event()
        self._threads: List[threading.Thread] = []
        self._pending_commands: Dict[str, threading.Event] = {}
        self._command_results: Dict[str, CommandResult] = {}
        self._state_cache: Dict[str, Any] = {}
        self._target_cell_by_target_id: Dict[str, str] = {}
        self._local_peer = PeerInfo(node_id=identity.node_id, display_name=identity.display_name, public_key=identity.public_key)
        self._local_peer.endpoint = NodeEndpoint(host="127.0.0.1", port=0)
        self._local_peer.role = NodeRole.COMMAND
        self._local_peer.metadata["vendor"] = identity.vendor
        self._local_peer.metadata["model"] = identity.model
        self._local_peer.metadata["public_key"] = identity.public_key
        self._local_peer.metadata["node_id"] = identity.node_id
        self._local_peer.metadata["created_at_ms"] = identity.created_at_ms
        self._mission_id = ""
        self._phase = MissionPhase.INIT
        self._version = 0
        self._shutdown_reason = ""
        self.faults = FaultInjector()

    def start(self) -> None:
        self.foxmq.connect()
        self.foxmq.subscribe(self.layout.discovery(), qos=2)
        self.foxmq.subscribe(self.layout.state(), qos=2)
        self.foxmq.subscribe(self.layout.delta(), qos=2)
        self.foxmq.subscribe(self.layout.role(), qos=2)
        self.foxmq.subscribe(self.layout.task(), qos=2)
        self.foxmq.subscribe(self.layout.task_bid(), qos=2)
        self.foxmq.subscribe(self.layout.task_commit(), qos=2)
        self.foxmq.subscribe(self.layout.safety(), qos=2)
        self.foxmq.subscribe(self.layout.alert(), qos=1)
        self.foxmq.subscribe(self.layout.command(self.identity.node_id), qos=2)
        self.foxmq.subscribe(self.layout.command_result(self.identity.node_id), qos=2)
        self.foxmq.subscribe(self.layout.telemetry(self.identity.node_id), qos=2)
        self.foxmq.subscribe(self.layout.sensor(self.identity.node_id), qos=2)
        self.map_sync.start()
        self._start_threads()
        self.publish_hello()
        self.publish_heartbeat()
        self.events.emit("backend_started", {"node_id": self.identity.node_id, "swarm_id": self.swarm_id})

    def stop(self, reason: str = "shutdown") -> None:
        self._shutdown_reason = reason
        self._stop.set()
        for thread in self._threads:
            thread.join(timeout=1.0)
        try:
            self.publish_goodbye()
        except Exception:
            LOG.exception("goodbye publish failed")
        self.map_sync.stop()
        self.foxmq.disconnect()
        self.events.emit("backend_stopped", {"reason": reason})

    def _start_threads(self) -> None:
        loops = [self._heartbeat_loop, self._task_loop, self._consensus_loop, self._metrics_loop, self._health_loop, self._recovery_loop]
        for target in loops:
            thread = threading.Thread(target=target, daemon=True)
            thread.start()
            self._threads.append(thread)

    def create_mission(self, name: str, scenario: ScenarioKind, *, description: str = "", metadata: Optional[Dict[str, Any]] = None) -> str:
        mission_id = f"mission-{random.getrandbits(48):012x}"
        self._mission_id = mission_id
        self._phase = MissionPhase.INIT
        meta = metadata or {}
        meta.update({"name": name, "scenario": scenario.value, "description": description})
        entry = self.ledger.append(mission_id, EventType.MISSION_CREATED, self.identity.node_id, meta)
        self._persist_mission_state(mission_id, name, scenario, description, meta)
        self._commit_mission_event(EventType.MISSION_CREATED, {"entry": asdict(entry), "mission_id": mission_id, "name": name, "scenario": scenario.value})
        return mission_id

    def set_phase(self, mission_id: str, phase: MissionPhase, *, reason: str = "") -> MissionCheckpoint:
        self._phase = phase
        payload = {"mission_id": mission_id, "phase": phase.value, "reason": reason, "node_id": self.identity.node_id}
        entry = self.ledger.append(mission_id, EventType.MISSION_PHASE, self.identity.node_id, payload)
        checkpoint = MissionCheckpoint(
            checkpoint_id=f"cp-{random.getrandbits(32):08x}",
            mission_id=mission_id,
            phase=phase,
            version=self._version + 1,
            state_hash=stable_hash(self.debug_bundle()),
            metadata={"ledger_entry": entry.entry_id, "reason": reason},
        )
        self._version += 1
        self._persist_checkpoint(checkpoint)
        self._commit_consensus(ConsensusKind.CHECKPOINT, {"checkpoint": asdict(checkpoint)})
        self._publish_kind(
            EnvelopeKind.STATE,
            self.layout.state(),
            {"type": "mission_phase", "mission_id": mission_id, "phase": phase.value, "reason": reason, "checkpoint": asdict(checkpoint)},
        )
        return checkpoint

    def _persist_mission_state(self, mission_id: str, name: str, scenario: ScenarioKind, description: str, metadata: Dict[str, Any]) -> None:
        state = self.store.load({})
        state.setdefault("missions", {})[mission_id] = {
            "name": name,
            "scenario": scenario.value,
            "description": description,
            "metadata": metadata,
            "created_at_ms": now_ms(),
            "updated_at_ms": now_ms(),
        }
        self.store.save(state)

    def _persist_checkpoint(self, checkpoint: MissionCheckpoint) -> None:
        state = self.store.load({})
        state.setdefault("checkpoints", {})[checkpoint.checkpoint_id] = asdict(checkpoint)
        self.store.save(state)

    def _commit_mission_event(self, event_type: EventType, payload: Dict[str, Any]) -> None:
        if self._mission_id:
            self.ledger.append(self._mission_id, event_type, self.identity.node_id, payload)

    def _commit_consensus(self, kind: ConsensusKind, payload: Dict[str, Any]) -> Dict[str, Any]:
        record = self.vertex.submit(kind, payload)
        self._commit_to_log(kind, payload, record)
        return record

    def _commit_to_log(self, kind: ConsensusKind, payload: Dict[str, Any], record: Dict[str, Any]) -> None:
        self.consensus_log.save({"last": {"kind": kind.value, "payload": payload, "record": record, "ts_ms": now_ms()}})
        self.metrics.inc("consensus_commits", kind=kind.value)
        self.events.emit("consensus", {"kind": kind.value, "payload": payload, "record": record})

    def propose_role_change(self, node_id: str, role: NodeRole, *, reason: str = "") -> Dict[str, Any]:
        payload = {"node_id": node_id, "role": role.value, "reason": reason, "requested_by": self.identity.node_id, "ts_ms": now_ms()}
        return self._commit_consensus(ConsensusKind.ROLE_CHANGE, payload)

    def commit_safety(self, reason: str, details: Dict[str, Any]) -> Dict[str, Any]:
        payload = {"reason": reason, "details": details, "committer": self.identity.node_id, "ts_ms": now_ms()}
        return self._commit_consensus(ConsensusKind.SAFETY_COMMIT, payload)

    def commit_target(self, target: RescueTarget, *, reason: str = "") -> Dict[str, Any]:
        payload = {"target": target.to_dict(), "reason": reason, "committer": self.identity.node_id, "ts_ms": now_ms()}
        return self._commit_consensus(ConsensusKind.TARGET_COMMIT, payload)

    def commit_map(self, snapshot: SharedMapSnapshot, *, reason: str = "") -> Dict[str, Any]:
        payload = {"snapshot": snapshot.to_dict(), "reason": reason, "committer": self.identity.node_id, "ts_ms": now_ms()}
        return self._commit_consensus(ConsensusKind.MAP_COMMIT, payload)

    def submit_replay_proof(self, message_id: str, source: str, *, accepted: bool, reason: str = "") -> Dict[str, Any]:
        payload = {"message_id": message_id, "source": source, "accepted": accepted, "reason": reason, "ts_ms": now_ms()}
        return self._commit_consensus(ConsensusKind.REPLAY_PROOF, payload)

    def submit_ordered_command(self, request: CommandRequest) -> Dict[str, Any]:
        payload = {"command": request.to_dict(), "requested_by": self.identity.node_id, "ts_ms": now_ms()}
        return self._commit_consensus(ConsensusKind.COMMAND_ORDER, payload)

    def _publish_kind(
        self,
        kind: Any,
        topic: str,
        payload: Dict[str, Any],
        *,
        ttl: int = 4,
        correlation_id: Optional[str] = None,
        reply_to: Optional[str] = None,
    ) -> str:
        message_id = f"msg-{random.getrandbits(48):012x}"
        kind_s = _envelope_kind_str(kind)
        envelope = P2PEnvelope(
            message_id=message_id,
            kind=kind_s,
            sender_id=self.identity.node_id,
            topic=topic,
            payload=payload,
            ttl=ttl,
            correlation_id=correlation_id,
            reply_to=reply_to,
        )
        envelope.signature = self.p2p_signer.sign(envelope)
        raw = envelope.to_json()
        qos_low = {"alert", "metrics", "heartbeat"}
        qos = 1 if kind_s in qos_low else 2
        try:
            self.foxmq.publish(topic, raw, qos=qos, retain=False)
            self.metrics.inc("published", kind=kind_s)
        except Exception:
            LOG.exception("publish failed: %s", topic)
            self.metrics.inc("publish_failed", kind=kind_s)
        return message_id

    def publish_hello(self) -> str:
        payload = {
            "peer": asdict(self._local_peer),
            "identity": identity_public_dict(self.identity),
            "ts_ms": now_ms(),
            "version": self._version,
        }
        return self._publish_kind(EnvelopeKind.HELLO, self.layout.discovery(), payload)

    def publish_goodbye(self) -> str:
        payload = {"node_id": self.identity.node_id, "reason": self._shutdown_reason or "shutdown", "ts_ms": now_ms(), "version": self._version}
        return self._publish_kind(EnvelopeKind.GOODBYE, self.layout.discovery(), payload, ttl=1)

    def publish_heartbeat(self) -> str:
        payload = {
            "node_id": self.identity.node_id,
            "role": self._local_peer.role.value,
            "battery_pct": self._local_peer.battery_pct,
            "cpu_pct": self._local_peer.cpu_pct,
            "memory_pct": self._local_peer.memory_pct,
            "mission_id": self._local_peer.mission_id,
            "endpoint": self._local_peer.endpoint.uri() if self._local_peer.endpoint else "",
            "capabilities": list(self._local_peer.capabilities),
            "ts_ms": now_ms(),
            "version": self._version,
        }
        return self._publish_kind(EnvelopeKind.HEARTBEAT, self.layout.peer(self.identity.node_id), payload)

    def publish_metrics(self) -> str:
        payload = {"node_id": self.identity.node_id, "metrics": self.metrics.summary(), "peer_summary": self.peers.summary(), "map": self.world_map.summary(), "ts_ms": now_ms()}
        return self._publish_kind(EnvelopeKind.METRICS, self.layout.metrics(), payload)

    def publish_role_update(self, peer_id: str, role: NodeRole, *, reason: str = "") -> str:
        payload = {"peer_id": peer_id, "role": role.value, "reason": reason, "publisher": self.identity.node_id, "version": self._version, "ts_ms": now_ms()}
        return self._publish_kind(EnvelopeKind.ROLE, self.layout.role(), payload)

    def publish_state_snapshot(self) -> str:
        snapshot = self.world_map.snapshot()
        payload = {"type": "shared_map_snapshot", "snapshot": snapshot.to_dict(), "node_id": self.identity.node_id, "ts_ms": now_ms(), "version": snapshot.version}
        return self._publish_kind(EnvelopeKind.STATE, self.layout.state(), payload)

    def publish_state_delta(self) -> str:
        delta = self.world_map.delta()
        payload = {"type": "shared_map_delta", "delta": delta.to_dict(), "node_id": self.identity.node_id, "ts_ms": now_ms()}
        return self._publish_kind(EnvelopeKind.DELTA, self.layout.delta(), payload)

    def publish_telemetry(self, telemetry: TelemetryFrame) -> str:
        self._local_peer.touch(battery_pct=telemetry.battery.pct, cpu_pct=telemetry.cpu_pct, memory_pct=telemetry.memory_pct, mission_id=telemetry.mission_id)
        self.peers.register(self._local_peer)
        self.metrics.inc("telemetry_published")
        events = self.safety.inspect(telemetry)
        for ev in events:
            self.publish_safety(ev)
        self.world_map.mark_seen(int(round(telemetry.position.x)), int(round(telemetry.position.y)), int(round(telemetry.position.z)), owner=self.identity.node_id, confidence=0.8)
        self.events.emit("telemetry_published", {"telemetry": telemetry.to_dict()})
        return self._publish_kind(EnvelopeKind.TELEMETRY, self.layout.telemetry(telemetry.node_id), telemetry.to_dict())

    def publish_sensor(self, reading: SensorReading) -> str:
        payload = reading.to_dict() | {"node_id": self.identity.node_id, "ts_ms": now_ms()}
        self.metrics.inc("sensor_published", sensor_type=reading.sensor_type)
        return self._publish_kind(EnvelopeKind.SENSOR, self.layout.sensor(self.identity.node_id), payload)

    def publish_safety(self, event: SafetyEvent) -> str:
        payload = event.to_dict() | {"publisher": self.identity.node_id}
        self.metrics.inc("safety_published")
        return self._publish_kind(EnvelopeKind.SAFETY, self.layout.safety(), payload)

    def publish_alert(self, alert_type: str, payload: Dict[str, Any]) -> str:
        body = {"alert_type": alert_type, "payload": payload, "node_id": self.identity.node_id, "ts_ms": now_ms()}
        self.metrics.inc("alerts_published")
        return self._publish_kind(EnvelopeKind.ALERT, self.layout.alert(), body, ttl=2)

    def publish_task(self, mission_id: str, task_id: str, task_type: str, requirements: Dict[str, Any], *, closes_in_s: int = 30) -> str:
        self.tasks.propose(task_id, mission_id, task_type, requirements, self.identity.node_id, closes_in_s=closes_in_s)
        body = {"mission_id": mission_id, "task_id": task_id, "task_type": task_type, "requirements": requirements, "proposer_id": self.identity.node_id, "ts_ms": now_ms()}
        self.metrics.inc("tasks_published")
        return self._publish_kind(EnvelopeKind.TASK, self.layout.task(), body)

    def publish_bid(self, task_id: str, score: float, eta_ms: int, *, resources: Optional[Dict[str, Any]] = None, notes: Optional[Dict[str, Any]] = None) -> str:
        bid = TaskBid(task_id=task_id, bidder_id=self.identity.node_id, score=score, eta_ms=eta_ms, resources=resources or {}, notes=notes or {})
        self.tasks.add_bid(bid)
        body = {"bid": asdict(bid), "node_id": self.identity.node_id, "ts_ms": now_ms()}
        self.metrics.inc("bids_published")
        return self._publish_kind(EnvelopeKind.TASK_BID, self.layout.task_bid(), body, correlation_id=task_id)

    def publish_task_commit(self, task_id: str) -> Optional[str]:
        task = self.tasks.assign_best(task_id)
        if task is None:
            return None
        body = {"task": asdict(task), "node_id": self.identity.node_id, "ts_ms": now_ms()}
        self.metrics.inc("task_commits_published")
        return self._publish_kind(EnvelopeKind.TASK_COMMIT, self.layout.task_commit(), body, correlation_id=task_id)

    def publish_command(self, target_id: str, command: str, args: Dict[str, Any], *, ttl: int = 3, expect_ack: bool = True) -> str:
        request = CommandRequest(command_id=f"cmd-{random.getrandbits(32):08x}", requester_id=self.identity.node_id, target_id=target_id, command=command, args=args, ttl=ttl, expect_ack=expect_ack)
        ordered = self.submit_ordered_command(request)
        self._pending_commands[request.command_id] = threading.Event()
        self.metrics.inc("commands_published", command=command)
        self._publish_kind(
            EnvelopeKind.COMMAND,
            self.layout.command(target_id),
            request.to_dict(),
            ttl=ttl,
            correlation_id=request.command_id,
            reply_to=self.layout.command_result(self.identity.node_id),
        )
        return str(ordered.get("sequence", request.command_id)) if isinstance(ordered, dict) else request.command_id

    def ingest_raw(self, topic: str, raw_payload: str) -> Optional[Dict[str, Any]]:
        try:
            envelope = P2PEnvelope.from_json(raw_payload)
        except Exception:
            self.metrics.inc("bad_payloads")
            return None
        if envelope.sender_id == self.identity.node_id:
            return None
        if envelope.signature and not self.p2p_signer.verify(envelope, envelope.signature):
            self.metrics.inc("signature_failures")
            return None
        if not self.replay_guard.record(envelope.message_id):
            self.metrics.inc("replays_blocked")
            self.submit_replay_proof(envelope.message_id, envelope.sender_id, accepted=False, reason="duplicate")
            return None
        if self.dedupe.seen(envelope.message_id):
            self.metrics.inc("duplicates_blocked")
            return None
        self.metrics.inc("messages_received", kind=envelope.kind)
        return self._dispatch(envelope)

    def _dispatch(self, envelope: P2PEnvelope) -> Optional[Dict[str, Any]]:
        kind = envelope.kind
        if kind == EnvelopeKind.HELLO.value:
            return self._handle_hello(envelope)
        if kind == EnvelopeKind.GOODBYE.value:
            return self._handle_goodbye(envelope)
        if kind == EnvelopeKind.HEARTBEAT.value:
            return self._handle_heartbeat(envelope)
        if kind == EnvelopeKind.ROLE.value:
            return self._handle_role(envelope)
        if kind == EnvelopeKind.TELEMETRY.value:
            return self._handle_telemetry(envelope)
        if kind == EnvelopeKind.SENSOR.value:
            return self._handle_sensor(envelope)
        if kind == EnvelopeKind.STATE.value:
            return self._handle_state(envelope)
        if kind == EnvelopeKind.DELTA.value:
            return self._handle_delta(envelope)
        if kind == EnvelopeKind.TASK.value:
            return self._handle_task(envelope)
        if kind == EnvelopeKind.TASK_BID.value:
            return self._handle_task_bid(envelope)
        if kind == EnvelopeKind.TASK_COMMIT.value:
            return self._handle_task_commit(envelope)
        if kind == EnvelopeKind.SAFETY.value:
            return self._handle_safety(envelope)
        if kind == EnvelopeKind.ALERT.value:
            return self._handle_alert(envelope)
        if kind == EnvelopeKind.COMMAND.value:
            return self._handle_command(envelope)
        if kind == EnvelopeKind.COMMAND_RESULT.value:
            return self._handle_command_result(envelope)
        if kind == EnvelopeKind.METRICS.value:
            return self._handle_metrics(envelope)
        if kind == EnvelopeKind.GOSSIP.value:
            return self._handle_gossip(envelope)
        return self._handle_custom(envelope)

    def _handle_hello(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        peer = self._parse_peer(envelope.payload.get("peer") or envelope.payload.get("node") or envelope.payload)
        self.peers.register(peer)
        self.events.emit("peer_hello", {"peer": asdict(peer)})
        self.metrics.inc("hello_seen")
        return {"ok": True, "peer_id": peer.node_id}

    def _handle_goodbye(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        node_id = str(envelope.payload.get("node_id", envelope.sender_id))
        self.peers.remove(node_id)
        self.metrics.inc("goodbye_seen")
        self.events.emit("peer_left", {"node_id": node_id})
        return {"removed": node_id}

    def _handle_heartbeat(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        peer = self._parse_peer(envelope.payload)
        self.peers.register(peer)
        self.metrics.inc("heartbeat_seen")
        return {"peer_id": peer.node_id, "role": peer.role.value}

    def _handle_role(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        peer_id = str(envelope.payload.get("peer_id", envelope.sender_id))
        role = NodeRole(str(envelope.payload.get("role", NodeRole.STANDBY.value)))
        peer = self.peers.get(peer_id) or PeerInfo(node_id=peer_id, display_name=peer_id, public_key=str(envelope.payload.get("public_key", "")))
        peer.role = role
        self.peers.register(peer)
        self.metrics.inc("role_seen")
        return {"peer_id": peer_id, "role": role.value}

    def _handle_telemetry(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        telemetry = TelemetryFrame.from_dict(envelope.payload)
        self.peers.register(
            PeerInfo(
                node_id=telemetry.node_id,
                display_name=telemetry.node_id,
                public_key=str(envelope.payload.get("public_key", "")),
                role=telemetry.role,
                battery_pct=telemetry.battery.pct,
                cpu_pct=telemetry.cpu_pct,
                memory_pct=telemetry.memory_pct,
                mission_id=telemetry.mission_id,
                capabilities=list(telemetry.extras.get("capabilities", [])),
            )
        )
        self.world_map.mark_seen(int(round(telemetry.position.x)), int(round(telemetry.position.y)), int(round(telemetry.position.z)), owner=telemetry.node_id, confidence=0.8)
        for ev in self.safety.inspect(telemetry):
            self.publish_safety(ev)
        self.events.emit("telemetry", {"telemetry": telemetry.to_dict()})
        self.metrics.inc("telemetry_seen")
        return {"node_id": telemetry.node_id}

    def _handle_sensor(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        reading = SensorReading.from_dict(envelope.payload)
        self.events.emit("sensor", {"reading": reading.to_dict()})
        self.metrics.inc("sensor_seen", sensor_type=reading.sensor_type)
        return {"sensor_id": reading.reading_id}

    def _handle_state(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        payload = envelope.payload
        if payload.get("type") == "shared_map_snapshot":
            snapshot = payload.get("snapshot", {})
            self.world_map.merge(list(snapshot.get("cells", {}).values()), source_version=int(snapshot.get("version", 0)), source_node_id=envelope.sender_id)
            self.metrics.inc("state_snapshots_seen")
            return {"merged": True}
        if payload.get("type") == "mission_phase":
            self._phase = MissionPhase(str(payload.get("phase", self._phase.value)))
            self.metrics.inc("mission_phase_seen")
            return {"phase": self._phase.value}
        if payload.get("type") == "swarm_state":
            self._state_cache.update(payload)
            self.metrics.inc("swarm_state_seen")
            return {"ok": True}
        return {"ok": True}

    def _handle_delta(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        payload = envelope.payload
        if payload.get("type") == "shared_map_delta":
            delta = payload.get("delta", {})
            self.world_map.merge(list(delta.get("cells", [])), source_version=int(delta.get("base_version", 0)), source_node_id=envelope.sender_id)
            self.metrics.inc("state_deltas_seen")
            return {"merged": True}
        return {"ok": True}

    def _handle_task(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        payload = envelope.payload
        task = payload.get("task") or payload
        self.tasks.propose(
            str(task.get("task_id", envelope.message_id)),
            str(task.get("mission_id", self._mission_id)),
            str(task.get("task_type", "generic")),
            dict(task.get("requirements", {})),
            str(task.get("proposer_id", envelope.sender_id)),
            closes_in_s=int(task.get("closes_in_s", 30)),
        )
        self.metrics.inc("task_seen")
        return {"task_id": task.get("task_id")}

    def _handle_task_bid(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        payload = envelope.payload
        bid = payload.get("bid") or payload
        task_bid = TaskBid(
            task_id=str(bid.get("task_id", envelope.correlation_id or envelope.message_id)),
            bidder_id=str(bid.get("bidder_id", envelope.sender_id)),
            score=float(bid.get("score", 0.0)),
            eta_ms=int(bid.get("eta_ms", 0)),
            resources=dict(bid.get("resources", {})),
            notes=dict(bid.get("notes", {})),
        )
        self.tasks.add_bid(task_bid)
        self.metrics.inc("task_bid_seen")
        return {"task_id": task_bid.task_id, "bidder_id": task_bid.bidder_id}

    def _handle_task_commit(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        payload = envelope.payload
        task_data = payload.get("task") or payload
        task_id = str(task_data.get("task_id", envelope.correlation_id or envelope.message_id))
        task = self.tasks.get(task_id)
        if task is None:
            return {"ok": False, "reason": "unknown_task"}
        best = task.best_bid()
        task.status = TaskStatus.ASSIGNED
        if best is not None:
            task.winner_id = best.bidder_id
        self.metrics.inc("task_commit_seen")
        return {"task_id": task_id, "winner_id": task.winner_id}

    def _handle_safety(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        payload = envelope.payload
        event = SafetyEvent(
            event_id=str(payload.get("event_id", f"safe-{random.getrandbits(32):08x}")),
            node_id=str(payload.get("node_id", envelope.sender_id)),
            severity=str(payload.get("severity", SafetyLevel.WARN.value)),
            reason=str(payload.get("reason", "remote")),
            details=dict(payload.get("details", {})),
            timestamp_ms=int(payload.get("timestamp_ms", now_ms())),
            position=GeoPoint.from_dict(payload["position"]) if isinstance(payload.get("position"), dict) else None,
        )
        self.safety._events.append(event)
        self.metrics.inc("safety_seen")
        return {"event_id": event.event_id}

    def _handle_alert(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        self.events.emit("alert", envelope.payload)
        self.metrics.inc("alert_seen")
        return {"ok": True}

    def _handle_command(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        req = CommandRequest.from_payload(envelope.payload)
        if req.target_id != self.identity.node_id:
            return {"ignored": True}
        result = self._execute_command(req)
        self._command_results[req.command_id] = result
        ev = self._pending_commands.get(req.command_id)
        if ev is not None:
            ev.set()
        if req.expect_ack:
            result_envelope = CommandResult(command_id=req.command_id, ok=result.ok, result=result.result, error=result.error)
            self._publish_kind(EnvelopeKind.COMMAND_RESULT, self.layout.command_result(req.requester_id), asdict(result_envelope), correlation_id=req.command_id)
        self.metrics.inc("command_seen", command=req.command)
        return asdict(result)

    def _handle_command_result(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        result = CommandResult.from_payload(envelope.payload)
        self._command_results[result.command_id] = result
        ev = self._pending_commands.get(result.command_id)
        if ev is not None:
            ev.set()
        self.metrics.inc("command_result_seen")
        return asdict(result)

    def _handle_metrics(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        self._state_cache["metrics"] = envelope.payload.get("metrics", {})
        self.metrics.inc("metrics_seen")
        return {"ok": True}

    def _handle_gossip(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        peers = envelope.payload.get("peers", [])
        for peer_id in peers:
            peer = self.peers.get(str(peer_id))
            if peer is not None:
                peer.last_seen_ms = now_ms()
        self.metrics.inc("gossip_seen")
        return {"count": len(peers)}

    def _handle_custom(self, envelope: P2PEnvelope) -> Dict[str, Any]:
        self.metrics.inc("custom_seen")
        self.events.emit("custom", {"envelope": asdict(envelope)})
        return {"ok": True}

    def _execute_command(self, req: CommandRequest) -> CommandResult:
        cmd = req.command.lower()
        try:
            if cmd == "request_health":
                return CommandResult(command_id=req.command_id, ok=True, result=self.health_summary())
            if cmd == "request_state":
                return CommandResult(command_id=req.command_id, ok=True, result=self.debug_bundle())
            if cmd == "takeoff":
                return CommandResult(command_id=req.command_id, ok=True, result={"takeoff": True, "altitude_m": float(req.args.get("altitude_m", 10.0))})
            if cmd == "land":
                return CommandResult(command_id=req.command_id, ok=True, result={"land": True})
            if cmd == "goto":
                return CommandResult(
                    command_id=req.command_id,
                    ok=True,
                    result={"goto": GeoPoint.from_dict(req.args.get("position", {})).to_dict(), "speed_mps": float(req.args.get("speed_mps", 2.0))},
                )
            if cmd == "estop":
                event = SafetyEvent(f"safe-{random.getrandbits(32):08x}", req.target_id, SafetyLevel.EMERGENCY.value, str(req.args.get("reason", "estop")), dict(req.args))
                self.publish_safety(event)
                return CommandResult(command_id=req.command_id, ok=True, result={"estop": True})
            if cmd == "set_role":
                role = NodeRole(str(req.args.get("role", NodeRole.STANDBY.value)))
                peer = self.peers.get(req.target_id) or PeerInfo(node_id=req.target_id, display_name=req.target_id, public_key=str(req.args.get("public_key", "")))
                peer.role = role
                self.peers.register(peer)
                self.publish_role_update(req.target_id, role, reason="remote_command")
                return CommandResult(command_id=req.command_id, ok=True, result={"role": role.value})
            if cmd == "set_mode":
                self._local_peer.metadata["mode"] = req.args.get("mode", "boot")
                return CommandResult(command_id=req.command_id, ok=True, result={"mode": req.args.get("mode", "boot")})
            if cmd == "sync_state":
                self.map_sync.request_sync(req.requester_id)
                return CommandResult(command_id=req.command_id, ok=True, result={"sync_requested": True})
            if cmd == "request_map":
                self.publish_state_snapshot()
                return CommandResult(command_id=req.command_id, ok=True, result={"map_requested": True})
            if cmd == "light_on":
                return CommandResult(command_id=req.command_id, ok=True, result={"light": "on"})
            if cmd == "light_off":
                return CommandResult(command_id=req.command_id, ok=True, result={"light": "off"})
            if cmd == "buzzer_on":
                return CommandResult(command_id=req.command_id, ok=True, result={"buzzer": "on"})
            if cmd == "buzzer_off":
                return CommandResult(command_id=req.command_id, ok=True, result={"buzzer": "off"})
            if cmd == "grip_open":
                return CommandResult(command_id=req.command_id, ok=True, result={"grip": "open"})
            if cmd == "grip_close":
                return CommandResult(command_id=req.command_id, ok=True, result={"grip": "close"})
            if cmd == "payload_arm":
                return CommandResult(command_id=req.command_id, ok=True, result={"payload": "armed"})
            if cmd == "payload_disarm":
                return CommandResult(command_id=req.command_id, ok=True, result={"payload": "disarmed"})
            if cmd == "return_home":
                return CommandResult(command_id=req.command_id, ok=True, result={"return_home": True})
            return CommandResult(command_id=req.command_id, ok=False, error=f"unsupported command: {req.command}")
        except Exception as exc:
            return CommandResult(command_id=req.command_id, ok=False, error=str(exc))

    def _heartbeat_loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.publish_heartbeat()
                self.publish_metrics()
            except Exception:
                LOG.exception("heartbeat loop failed")
            if self._stop.wait(2.0):
                break

    def _task_loop(self) -> None:
        while not self._stop.is_set():
            try:
                for task_id in self.tasks.expire():
                    self.events.emit("task_expired", {"task_id": task_id})
                    self.metrics.inc("task_expired")
                if self.world_map.dirty_count() > 0:
                    self.publish_state_delta()
                else:
                    self.publish_state_snapshot()
            except Exception:
                LOG.exception("task loop failed")
            if self._stop.wait(3.0):
                break

    def _consensus_loop(self) -> None:
        while not self._stop.is_set():
            try:
                if self._local_peer.role == NodeRole.EXPLORER:
                    self.propose_role_change(self.identity.node_id, NodeRole.EXPLORER, reason="leader_refresh")
                if self._mission_id:
                    self.commit_map(self.world_map.snapshot(), reason="periodic_map_commit")
                if self.safety.recent(1):
                    latest = self.safety.recent(1)[-1]
                    self.commit_safety(latest.get("reason", "safety"), latest.get("details", {}))
            except Exception:
                LOG.exception("consensus loop failed")
            if self._stop.wait(4.0):
                break

    def _metrics_loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.metrics.gauge("peer_count", float(len(self.peers.all())))
                self.metrics.gauge("active_peers", float(len(self.peers.active())))
                self.metrics.gauge("map_cells", float(self.world_map.summary()["cells"]))
                self.metrics.gauge("dirty_cells", float(self.world_map.dirty_count()))
            except Exception:
                LOG.exception("metrics loop failed")
            if self._stop.wait(5.0):
                break

    def _health_loop(self) -> None:
        while not self._stop.is_set():
            try:
                for peer in self.peers.stale(15.0):
                    peer.metadata["stale"] = True
                    self.metrics.inc("peer_stale")
                if self._local_peer.battery_pct < 10:
                    self._local_peer.role = NodeRole.EMERGENCY
                    self.publish_role_update(self.identity.node_id, NodeRole.EMERGENCY, reason="battery_low")
            except Exception:
                LOG.exception("health loop failed")
            if self._stop.wait(3.0):
                break

    def _recovery_loop(self) -> None:
        while not self._stop.is_set():
            try:
                self._recover_missing_state()
            except Exception:
                LOG.exception("recovery loop failed")
            if self._stop.wait(6.0):
                break

    def _recover_missing_state(self) -> None:
        self.map_sync.request_sync()
        self._state_cache.setdefault("last_recovery_ms", now_ms())
        self.metrics.inc("recovery_ticks")

    def register_peer(self, peer: PeerInfo) -> PeerInfo:
        peer = self.peers.register(peer)
        self.events.emit("peer_registered", {"peer": asdict(peer)})
        self.metrics.inc("peer_registered")
        return peer

    def current_role(self) -> NodeRole:
        return self._local_peer.role

    def set_local_role(self, role: NodeRole, *, reason: str = "") -> None:
        self._local_peer.role = role
        self._version += 1
        self.publish_role_update(self.identity.node_id, role, reason=reason or "local_role_change")

    def set_mission(self, mission_id: str, *, phase: MissionPhase = MissionPhase.INIT) -> None:
        self._mission_id = mission_id
        self._phase = phase
        self._local_peer.mission_id = mission_id
        self._version += 1

    def health_summary(self) -> Dict[str, Any]:
        return {
            "node_id": self.identity.node_id,
            "role": self._local_peer.role.value,
            "phase": self._phase.value,
            "mission_id": self._mission_id,
            "peer_count": len(self.peers.all()),
            "active_peers": len(self.peers.active()),
            "stale_peers": len(self.peers.stale()),
            "task_count": len(self.tasks.all()),
            "map": self.world_map.summary(),
            "safety_events": len(self.safety.recent(50)),
            "metrics": self.metrics.summary(),
            "timestamp_ms": now_ms(),
        }

    def debug_bundle(self) -> Dict[str, Any]:
        return {
            "identity": identity_public_dict(self.identity),
            "local_peer": asdict(self._local_peer),
            "mission_id": self._mission_id,
            "phase": self._phase.value,
            "peers": [asdict(peer) for peer in self.peers.all()],
            "tasks": [asdict(task) for task in self.tasks.all()],
            "map": self.world_map.snapshot().to_dict(),
            "ledger_tail": self.ledger.tail(50),
            "consensus_verify": self.ledger.verify(),
            "metrics": self.metrics.summary(),
            "state_cache": dict(self._state_cache),
            "faults": self.faults.summary(),
        }

    def export_json(self) -> str:
        return json_dump(self.debug_bundle())

    def scenario_config(self, scenario: ScenarioKind) -> Dict[str, Any]:
        base = {
            "scenario": scenario.value,
            "mission_phase": MissionPhase.INIT.value,
            "requires": ["telemetry", "map_sync", "task_board", "safety"],
            "priority": 1,
        }
        scenario_profiles = {
            ScenarioKind.COLLAPSED_BUILDING: {"risk": "collapse", "requires": ["victim_detection", "indoor", "low_altitude"], "priority": 5, "geo": "indoor"},
            ScenarioKind.CAVE_TUNNEL: {"risk": "gps_limited", "requires": ["relay_chain", "slam", "low_light"], "priority": 5, "geo": "tunnel"},
            ScenarioKind.FLOOD: {"risk": "water", "requires": ["thermal", "life_ring", "high_clearance"], "priority": 5, "geo": "water"},
            ScenarioKind.WILDFIRE: {"risk": "smoke_heat", "requires": ["thermal", "gas", "high_temp"], "priority": 5, "geo": "open"},
            ScenarioKind.INDUSTRIAL: {"risk": "hazmat", "requires": ["gas", "barometer", "safety_stop"], "priority": 5, "geo": "industrial"},
            ScenarioKind.FOREST: {"risk": "wide_area", "requires": ["long_range", "camera", "gossip"], "priority": 3, "geo": "outdoor"},
            ScenarioKind.NIGHT: {"risk": "low_visibility", "requires": ["ir", "light", "relay"], "priority": 4, "geo": "outdoor"},
            ScenarioKind.INDOOR: {"risk": "restricted_space", "requires": ["compact", "slam", "indoor"], "priority": 4, "geo": "indoor"},
            ScenarioKind.PERIMETER: {"risk": "boundary", "requires": ["coverage", "relay", "patrol"], "priority": 2, "geo": "perimeter"},
            ScenarioKind.TRIAGE: {"risk": "multiple_targets", "requires": ["victim_detection", "routing", "priority_queue"], "priority": 5, "geo": "mixed"},
        }
        base.update(scenario_profiles.get(scenario, {}))
        return base

    def create_scenario_mission(self, name: str, scenario: ScenarioKind, description: str = "", metadata: Optional[Dict[str, Any]] = None) -> str:
        meta = metadata.copy() if metadata else {}
        meta.update(self.scenario_config(scenario))
        mission_id = self.create_mission(name, scenario, description=description, metadata=meta)
        self.set_mission(mission_id, phase=MissionPhase.DISCOVERY)
        self.set_phase(mission_id, MissionPhase.DISCOVERY, reason="scenario_mission_bootstrap")
        return mission_id

    def ingest_target(self, target: RescueTarget) -> Dict[str, Any]:
        self.commit_target(target, reason="sensor_discovery")
        if target.position is not None:
            x, y, z = int(round(target.position.x)), int(round(target.position.y)), int(round(target.position.z))
            cell_id = f"{x}:{y}:{z}"
            self._target_cell_by_target_id[target.target_id] = cell_id
            self.world_map.mark_target(x, y, z, owner=target.discovered_by, target_type=target.target_type, confidence=target.confidence)
        return target.to_dict()

    def assign_target(self, mission_id: str, target: RescueTarget, requirements: Dict[str, Any]) -> Optional[MissionTask]:
        task_id = f"task-{random.getrandbits(32):08x}"
        self.publish_task(mission_id, task_id, target.target_type, requirements)
        task = self.tasks.get(task_id)
        if task is not None:
            task.status = TaskStatus.ASSIGNED
            task.winner_id = target.assigned_to
        return task

    def complete_target(self, mission_id: str, target_id: str, by_node: str, *, extracted: bool = True) -> None:
        cell_id = self._target_cell_by_target_id.get(target_id)
        if cell_id is not None:
            cell = self.world_map.get_cell(cell_id)
            if cell is not None:
                cell.touch(state=CellState.SEARCHED, owner=by_node)
                self.world_map.persist()
        target = RescueTarget(target_id=target_id, target_type="victim", extracted_by=by_node, status="extracted" if extracted else "confirmed")
        self.commit_target(target, reason="target_completed")
        self.ledger.append(mission_id, EventType.TARGET_EXTRACTED, by_node, {"target_id": target_id, "extracted": extracted})
        self._commit_consensus(ConsensusKind.TARGET_COMMIT, {"mission_id": mission_id, "target": target.to_dict(), "extracted": extracted})

    def publish_geofence(self, fence: GeoFence) -> None:
        self.geofences.add(fence)
        self._publish_kind(EnvelopeKind.GEOFENCE, f"{self.layout.base()}/geofence", fence.to_dict(), ttl=4)

    def publish_gossip(self) -> None:
        peers = [peer.node_id for peer in self.peers.active()[:10]]
        self._publish_kind(EnvelopeKind.GOSSIP, self.layout.gossip(), {"node_id": self.identity.node_id, "peers": peers, "ts_ms": now_ms()})

    def _parse_peer(self, payload: Any) -> PeerInfo:
        if not isinstance(payload, dict):
            return PeerInfo(node_id="unknown", display_name="unknown", public_key="")
        node_id = str(payload.get("node_id", payload.get("id", "unknown")))
        display_name = str(payload.get("display_name", node_id))
        public_key = str(payload.get("public_key", ""))
        role = NodeRole(str(payload.get("role", NodeRole.STANDBY.value)))
        peer = PeerInfo(
            node_id=node_id,
            display_name=display_name,
            public_key=public_key,
            role=role,
            battery_pct=float(payload.get("battery_pct", 100.0)),
            cpu_pct=float(payload.get("cpu_pct", 0.0)),
            memory_pct=float(payload.get("memory_pct", 0.0)),
            mission_id=str(payload.get("mission_id", "")),
            capabilities=list(payload.get("capabilities", [])),
        )
        endpoint_raw = payload.get("endpoint")
        if isinstance(endpoint_raw, str) and endpoint_raw:
            try:
                from urllib.parse import urlparse

                parsed = urlparse(endpoint_raw)
                host = parsed.hostname or "127.0.0.1"
                port = parsed.port or (1883 if parsed.scheme != "mqtts" else 8883)
                peer.endpoint = NodeEndpoint(host=host, port=port, scheme=parsed.scheme or "mqtt")
            except Exception:
                peer.endpoint = NodeEndpoint(host="127.0.0.1", port=0)
        return peer


# ---------------------------------------------------------------------------
# Fault injection and recovery demo support
# ---------------------------------------------------------------------------


class FaultMode(str, Enum):
    DROP = "drop"
    DELAY = "delay"
    CORRUPT = "corrupt"
    DUPLICATE = "duplicate"
    PAUSE = "pause"
    CRASH = "crash"
    RECOVER = "recover"


@dataclass(slots=True)
class FaultRule:
    rule_id: str
    mode: FaultMode
    target_node_id: str = ""
    target_topic: str = ""
    loss_rate: float = 0.0
    delay_ms: int = 0
    corrupt_rate: float = 0.0
    duration_s: float = 0.0
    created_at_ms: int = field(default_factory=now_ms)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def active(self) -> bool:
        return self.duration_s <= 0 or (now_ms() - self.created_at_ms) / 1000.0 <= self.duration_s


class FaultInjector:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._rules: Dict[str, FaultRule] = {}
        self._paused: Set[str] = set()
        self._crashed: Set[str] = set()

    def add(self, rule: FaultRule) -> None:
        with self._lock:
            self._rules[rule.rule_id] = rule
            if rule.mode == FaultMode.PAUSE:
                self._paused.add(rule.target_node_id)
            if rule.mode == FaultMode.CRASH:
                self._crashed.add(rule.target_node_id)

    def remove(self, rule_id: str) -> bool:
        with self._lock:
            rule = self._rules.pop(rule_id, None)
            if rule is None:
                return False
            self._paused.discard(rule.target_node_id)
            self._crashed.discard(rule.target_node_id)
            return True

    def is_crashed(self, node_id: str) -> bool:
        with self._lock:
            return node_id in self._crashed

    def is_paused(self, node_id: str) -> bool:
        with self._lock:
            return node_id in self._paused

    def should_drop(self, node_id: str, topic: str) -> bool:
        with self._lock:
            for rule in self._rules.values():
                if not rule.active():
                    continue
                if rule.target_node_id and rule.target_node_id != node_id:
                    continue
                if rule.target_topic and rule.target_topic not in topic:
                    continue
                if rule.mode == FaultMode.DROP and random.random() < rule.loss_rate:
                    return True
            return False

    def maybe_delay(self, node_id: str, topic: str) -> int:
        with self._lock:
            delay = 0
            for rule in self._rules.values():
                if not rule.active():
                    continue
                if rule.target_node_id and rule.target_node_id != node_id:
                    continue
                if rule.target_topic and rule.target_topic not in topic:
                    continue
                if rule.mode == FaultMode.DELAY:
                    delay = max(delay, rule.delay_ms)
            return delay

    def maybe_corrupt(self, node_id: str, payload: str) -> str:
        with self._lock:
            for rule in self._rules.values():
                if not rule.active():
                    continue
                if rule.target_node_id and rule.target_node_id != node_id:
                    continue
                if rule.mode == FaultMode.CORRUPT and random.random() < max(0.0, min(1.0, rule.corrupt_rate)):
                    return payload[::-1]
            return payload

    def should_duplicate(self, node_id: str, topic: str) -> bool:
        with self._lock:
            for rule in self._rules.values():
                if not rule.active():
                    continue
                if rule.target_node_id and rule.target_node_id != node_id:
                    continue
                if rule.target_topic and rule.target_topic not in topic:
                    continue
                if rule.mode == FaultMode.DUPLICATE:
                    return True
            return False

    def recover(self, node_id: str) -> None:
        with self._lock:
            self._paused.discard(node_id)
            self._crashed.discard(node_id)

    def summary(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "rules": [asdict(rule) for rule in self._rules.values()],
                "paused": sorted(self._paused),
                "crashed": sorted(self._crashed),
            }


class FaultAwareFoxMQ:
    def __init__(self, transport: FoxMQTransport, injector: FaultInjector, node_id: str) -> None:
        self.transport = transport
        self.injector = injector
        self.node_id = node_id

    def publish(self, topic: str, payload: str, qos: int = 2, retain: bool = False) -> Any:
        if self.injector.is_crashed(self.node_id):
            raise RuntimeError(f"node crashed: {self.node_id}")
        if self.injector.should_drop(self.node_id, topic):
            return None
        delay_ms = self.injector.maybe_delay(self.node_id, topic)
        if delay_ms:
            time.sleep(delay_ms / 1000.0)
        payload = self.injector.maybe_corrupt(self.node_id, payload)
        result = self.transport.publish(topic, payload, qos=qos, retain=retain)
        if self.injector.should_duplicate(self.node_id, topic):
            self.transport.publish(topic, payload, qos=qos, retain=retain)
        return result

    def subscribe(self, topic: str, qos: int = 2) -> Any:
        return self.transport.subscribe(topic, qos=qos)

    def connect(self) -> None:
        self.transport.connect()

    def disconnect(self) -> None:
        self.transport.disconnect()


# ---------------------------------------------------------------------------
# Scenario templates
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class ScenarioTemplate:
    scenario: ScenarioKind
    name: str
    description: str
    min_nodes: int
    recommended_roles: Dict[NodeRole, int]
    hazards: List[str] = field(default_factory=list)
    task_mix: Dict[str, int] = field(default_factory=dict)
    map_size: Tuple[int, int] = (50, 50)
    altitude_limit_m: float = 120.0
    notes: Dict[str, Any] = field(default_factory=dict)


_SCENARIO_LIBRARY_DATA: List[Dict[str, Any]] = [
    {
        "scenario": ScenarioKind.COLLAPSED_BUILDING,
        "name": "Collapsed Building",
        "description": "Search rooms, identify victims, relay in confined spaces.",
        "min_nodes": 5,
        "recommended_roles": {NodeRole.EXPLORER: 2, NodeRole.RELAY: 1, NodeRole.TRIAGE: 1, NodeRole.RESCUER: 1},
        "hazards": ["collapse", "dust", "gps_loss"],
        "task_mix": {"search": 5, "triage": 2, "relay": 1},
        "map_size": (30, 30),
        "notes": {"indoor": True, "low_light": True},
    },
    {
        "scenario": ScenarioKind.CAVE_TUNNEL,
        "name": "Cave / Tunnel",
        "description": "Operate with intermittent connectivity and minimal GPS.",
        "min_nodes": 4,
        "recommended_roles": {NodeRole.EXPLORER: 1, NodeRole.RELAY: 2, NodeRole.RESCUER: 1},
        "hazards": ["darkness", "narrow_passage", "link_loss"],
        "task_mix": {"relay": 2, "search": 3},
        "map_size": (60, 10),
        "notes": {"gps_restricted": True},
    },
    {
        "scenario": ScenarioKind.FLOOD,
        "name": "Flood Rescue",
        "description": "Track moving targets and maintain buoyant or high-clearance routes.",
        "min_nodes": 6,
        "recommended_roles": {NodeRole.EXPLORER: 1, NodeRole.TRANSPORT: 2, NodeRole.RESCUER: 2, NodeRole.RELAY: 1},
        "hazards": ["water", "current", "storm"],
        "task_mix": {"search": 4, "transport": 2, "relay": 1},
        "map_size": (50, 50),
        "notes": {"wet_ops": True},
    },
    {
        "scenario": ScenarioKind.WILDFIRE,
        "name": "Wildfire",
        "description": "Work through smoke, heat, and shifting safe corridors.",
        "min_nodes": 6,
        "recommended_roles": {NodeRole.EXPLORER: 2, NodeRole.RELAY: 1, NodeRole.TRIAGE: 2, NodeRole.RESCUER: 1},
        "hazards": ["heat", "smoke", "rapid_change"],
        "task_mix": {"search": 4, "triage": 2, "relay": 1},
        "map_size": (80, 80),
        "notes": {"thermal_priority": True},
    },
    {
        "scenario": ScenarioKind.INDUSTRIAL,
        "name": "Industrial / Hazmat",
        "description": "Handle gas, chemical, and safety exclusion zones.",
        "min_nodes": 5,
        "recommended_roles": {NodeRole.EXPLORER: 1, NodeRole.RELAY: 1, NodeRole.TRIAGE: 1, NodeRole.SENSOR: 2},
        "hazards": ["hazmat", "toxic", "sparks"],
        "task_mix": {"sensor": 3, "relay": 1, "search": 2},
        "map_size": (40, 40),
        "notes": {"safety_first": True},
    },
    {
        "scenario": ScenarioKind.FOREST,
        "name": "Forest Search",
        "description": "Wide-area coverage and long-range coordination.",
        "min_nodes": 5,
        "recommended_roles": {NodeRole.EXPLORER: 2, NodeRole.RELAY: 1, NodeRole.RESCUER: 2},
        "hazards": ["wide_area", "terrain", "weather"],
        "task_mix": {"search": 8, "relay": 2},
        "map_size": (100, 100),
        "notes": {"coverage": "wide"},
    },
    {
        "scenario": ScenarioKind.NIGHT,
        "name": "Night Search",
        "description": "Low visibility operations with light discipline.",
        "min_nodes": 4,
        "recommended_roles": {NodeRole.EXPLORER: 1, NodeRole.RELAY: 1, NodeRole.RESCUER: 2},
        "hazards": ["darkness", "line_of_sight", "fatigue"],
        "task_mix": {"search": 4, "light": 2, "relay": 1},
        "map_size": (50, 50),
        "notes": {"ir": True},
    },
    {
        "scenario": ScenarioKind.INDOOR,
        "name": "Indoor Multi-room",
        "description": "Room-to-room exploration and victim confirmation.",
        "min_nodes": 4,
        "recommended_roles": {NodeRole.EXPLORER: 2, NodeRole.TRIAGE: 1, NodeRole.RELAY: 1},
        "hazards": ["stairwell", "doorways", "gps_loss"],
        "task_mix": {"search": 6, "triage": 2},
        "map_size": (25, 25),
        "notes": {"indoor": True},
    },
    {
        "scenario": ScenarioKind.PERIMETER,
        "name": "Perimeter Sweep",
        "description": "Sweep a boundary and report breaches.",
        "min_nodes": 4,
        "recommended_roles": {NodeRole.EXPLORER: 1, NodeRole.RELAY: 1, NodeRole.SENSOR: 2},
        "hazards": ["boundary", "unauthorized", "outlier"],
        "task_mix": {"patrol": 4, "sensor": 2},
        "map_size": (60, 60),
        "notes": {"sweep": True},
    },
    {
        "scenario": ScenarioKind.TRIAGE,
        "name": "Disaster Triage",
        "description": "Prioritize victims and coordinate extraction.",
        "min_nodes": 5,
        "recommended_roles": {NodeRole.EXPLORER: 1, NodeRole.TRIAGE: 2, NodeRole.RESCUER: 2},
        "hazards": ["multiple_victims", "priority", "capacity"],
        "task_mix": {"triage": 4, "search": 2, "extract": 2},
        "map_size": (40, 40),
        "notes": {"victim_priority": True},
    },
]


class ScenarioLibrary:
    def __init__(self) -> None:
        self._templates: Dict[ScenarioKind, ScenarioTemplate] = {}
        for row in _SCENARIO_LIBRARY_DATA:
            sk = row["scenario"]
            self._templates[sk] = ScenarioTemplate(
                scenario=sk,
                name=row["name"],
                description=row["description"],
                min_nodes=row["min_nodes"],
                recommended_roles=dict(row["recommended_roles"]),
                hazards=list(row["hazards"]),
                task_mix=dict(row["task_mix"]),
                map_size=tuple(row["map_size"]),
                altitude_limit_m=float(row.get("altitude_limit_m", 120.0)),
                notes=dict(row.get("notes", {})),
            )

    def get(self, scenario: ScenarioKind) -> ScenarioTemplate:
        return self._templates[scenario]

    def list(self) -> List[ScenarioTemplate]:
        return list(self._templates.values())

    def as_dict(self) -> Dict[str, Any]:
        return {template.scenario.value: asdict(template) for template in self._templates.values()}


# ---------------------------------------------------------------------------
# Advanced sync and recovery
# ---------------------------------------------------------------------------


class SyncMode(str, Enum):
    SNAPSHOT = "snapshot"
    DELTA = "delta"
    PULL = "pull"
    PUSH = "push"


@dataclass(slots=True)
class SyncRecord:
    sync_id: str
    mode: SyncMode
    peer_id: str
    version: int
    started_at_ms: int = field(default_factory=now_ms)
    finished_at_ms: Optional[int] = None
    ok: bool = False
    reason: str = ""
    stats: Dict[str, Any] = field(default_factory=dict)


class RecoveryManager:
    def __init__(self, backend: VertexFoxMQBackend) -> None:
        self.backend = backend
        self._lock = threading.RLock()
        self._syncs: Deque[SyncRecord] = deque(maxlen=1000)

    def request_full_sync(self, peer_id: Optional[str] = None) -> SyncRecord:
        peer_id = peer_id or self.backend.identity.node_id
        rec = SyncRecord(sync_id=f"sync-{random.getrandbits(32):08x}", mode=SyncMode.PULL, peer_id=peer_id, version=self.backend.world_map.version)
        self.backend.map_sync.request_sync(peer_id)
        self._record(rec)
        return rec

    def push_snapshot(self) -> SyncRecord:
        rec = SyncRecord(sync_id=f"sync-{random.getrandbits(32):08x}", mode=SyncMode.PUSH, peer_id=self.backend.identity.node_id, version=self.backend.world_map.version)
        self.backend.publish_state_snapshot()
        rec.ok = True
        rec.finished_at_ms = now_ms()
        self._record(rec)
        return rec

    def push_delta(self) -> SyncRecord:
        rec = SyncRecord(sync_id=f"sync-{random.getrandbits(32):08x}", mode=SyncMode.DELTA, peer_id=self.backend.identity.node_id, version=self.backend.world_map.version)
        self.backend.publish_state_delta()
        rec.ok = True
        rec.finished_at_ms = now_ms()
        self._record(rec)
        return rec

    def restore_from_ledger(self) -> Dict[str, Any]:
        ok, reason = self.backend.ledger.verify()
        return {"ledger_ok": ok, "reason": reason, "tail": self.backend.ledger.tail(20)}

    def reconstruct_state(self) -> Dict[str, Any]:
        return {
            "health": self.backend.health_summary(),
            "debug": self.backend.debug_bundle(),
            "ledger": self.restore_from_ledger(),
        }

    def _record(self, record: SyncRecord) -> None:
        with self._lock:
            self._syncs.append(record)
            self.backend.metrics.inc("syncs")
            self.backend.events.emit("sync", asdict(record))

    def recent(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock:
            return [asdict(r) for r in list(self._syncs)[-limit:]]


# ---------------------------------------------------------------------------
# Higher-level orchestration
# ---------------------------------------------------------------------------


class SearchRescueOrchestrator:
    def __init__(self, backend: VertexFoxMQBackend, scenarios: ScenarioLibrary) -> None:
        self.backend = backend
        self.scenarios = scenarios
        self.recovery = RecoveryManager(backend)
        self._lock = threading.RLock()
        self._active_missions: Dict[str, Dict[str, Any]] = {}
        self._history: Deque[Dict[str, Any]] = deque(maxlen=1000)

    def start_mission(self, name: str, scenario: ScenarioKind, description: str = "", metadata: Optional[Dict[str, Any]] = None) -> str:
        template = self.scenarios.get(scenario)
        mission_id = self.backend.create_scenario_mission(name, scenario, description=description, metadata=metadata)
        with self._lock:
            self._active_missions[mission_id] = {"name": name, "scenario": scenario.value, "template": asdict(template), "started_at_ms": now_ms(), "phase": MissionPhase.DISCOVERY.value}
        self._history.append({"event": "mission_start", "mission_id": mission_id, "scenario": scenario.value, "ts_ms": now_ms()})
        return mission_id

    def move_phase(self, mission_id: str, phase: MissionPhase, reason: str = "") -> MissionCheckpoint:
        cp = self.backend.set_phase(mission_id, phase, reason=reason)
        with self._lock:
            if mission_id in self._active_missions:
                self._active_missions[mission_id]["phase"] = phase.value
        self._history.append({"event": "phase", "mission_id": mission_id, "phase": phase.value, "ts_ms": now_ms()})
        return cp

    def register_target(self, mission_id: str, target: RescueTarget) -> Dict[str, Any]:
        committed = self.backend.ingest_target(target)
        self._history.append({"event": "target_found", "mission_id": mission_id, "target_id": target.target_id, "ts_ms": now_ms()})
        return committed

    def assign_target(self, mission_id: str, target: RescueTarget, requirements: Dict[str, Any]) -> Optional[MissionTask]:
        task = self.backend.assign_target(mission_id, target, requirements)
        self._history.append({"event": "target_assigned", "mission_id": mission_id, "target_id": target.target_id, "ts_ms": now_ms()})
        return task

    def complete_target(self, mission_id: str, target_id: str, node_id: str) -> None:
        self.backend.complete_target(mission_id, target_id, node_id)
        self._history.append({"event": "target_extracted", "mission_id": mission_id, "target_id": target_id, "ts_ms": now_ms()})

    def sync(self) -> Dict[str, Any]:
        pull = self.recovery.request_full_sync()
        push = self.recovery.push_snapshot()
        return {"pull": asdict(pull), "push": asdict(push)}

    def recover(self) -> Dict[str, Any]:
        return self.recovery.reconstruct_state()

    def end_mission(self, mission_id: str, *, success: bool = True, reason: str = "") -> None:
        phase = MissionPhase.COMPLETE if success else MissionPhase.ABORTED
        self.backend.set_phase(mission_id, phase, reason=reason)
        with self._lock:
            self._active_missions.pop(mission_id, None)
        self._history.append({"event": "mission_end", "mission_id": mission_id, "success": success, "reason": reason, "ts_ms": now_ms()})

    def summary(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "active": list(self._active_missions.keys()),
                "history_tail": list(self._history)[-50:],
                "recovery": self.recovery.recent(10),
            }


# ---------------------------------------------------------------------------
# Builder and demo helpers
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class BackendBootstrapConfig:
    swarm_id: str
    node_id: str
    display_name: str
    public_key: str = ""
    vendor: str = "unknown"
    model: str = "generic"
    use_mock_vertex: bool = True
    use_mock_foxmq: bool = True
    persistence_dir: str = ".vertexfox"
    foxmq_host: str = "127.0.0.1"
    foxmq_port: int = 1883


def build_backend(cfg: BackendBootstrapConfig) -> VertexFoxMQBackend:
    identity = NodeIdentity.generate(cfg.node_id, cfg.display_name, vendor=cfg.vendor, model=cfg.model)
    if not cfg.use_mock_vertex:
        raise NotImplementedError("configure a real ConsensusEngine for Vertex integration")
    vertex: ConsensusEngine = MockVertexConsensusEngine(cfg.node_id)
    if not cfg.use_mock_foxmq:
        raise NotImplementedError("configure a real FoxMQTransport (see swarm/foxmq_integration.py)")
    foxmq: FoxMQTransport = MockFoxMQBus()
    return VertexFoxMQBackend(swarm_id=cfg.swarm_id, identity=identity, vertex=vertex, foxmq=foxmq, persistence_dir=cfg.persistence_dir)


def build_demo_backend() -> SearchRescueOrchestrator:
    backend = build_backend(BackendBootstrapConfig(swarm_id="sar-demo", node_id="node-a", display_name="Node A"))
    backend.set_local_role(NodeRole.COMMAND, reason="demo_boot")
    backend.geofences.add(GeoFence("demo-fence", "Demo Fence", [GeoPoint(0, 0, 0), GeoPoint(100, 0, 0), GeoPoint(100, 100, 0), GeoPoint(0, 100, 0)], min_alt_m=0, max_alt_m=120))
    scenarios = ScenarioLibrary()
    return SearchRescueOrchestrator(backend, scenarios)


def backend_smoke_demo() -> Dict[str, Any]:
    orch = build_demo_backend()
    mission_id = orch.start_mission("Warehouse Collapse", ScenarioKind.COLLAPSED_BUILDING, "Indoor victim search")
    orch.move_phase(mission_id, MissionPhase.SEARCH, reason="entered_search")
    target = RescueTarget(target_id="victim-1", target_type="victim", priority=10, confidence=0.95, position=GeoPoint(12, 8, 0), discovered_by="node-a")
    orch.register_target(mission_id, target)
    orch.assign_target(mission_id, target, {"role": "rescuer", "capabilities": ["camera", "thermal"], "min_battery_pct": 40})
    orch.complete_target(mission_id, target.target_id, "node-a")
    orch.sync()
    orch.move_phase(mission_id, MissionPhase.RESCUE, reason="target_confirmed")
    orch.end_mission(mission_id, success=True, reason="demo_complete")
    return {
        "backend": orch.backend.debug_bundle(),
        "mission_summary": orch.summary(),
        "scenario_library": orch.scenarios.as_dict(),
        "metrics": orch.backend.metrics.summary(),
        "prometheus": orch.backend.metrics.render_prometheus(),
    }


if __name__ == "__main__":  # pragma: no cover
    logging.basicConfig(level=logging.INFO)
    print(json_dump(backend_smoke_demo()))
