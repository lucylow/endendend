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


# NOTE: file continues in part 2 (tasks, safety, backend, scenarios) — appended below.
