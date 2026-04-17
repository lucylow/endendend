"""IoT helpers for drone swarm telemetry and commands (FoxMQ / Vertex-friendly).

Provides signed envelopes, MQTT-style topic helpers, a small device registry,
offline publish buffering, and a bridge that can sit alongside
``swarm.foxmq_integration`` without replacing swarm control code.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import random
import threading
import time
from collections import defaultdict, deque
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, DefaultDict, Deque, Mapping

LOG = logging.getLogger(__name__)


def current_time_ms() -> int:
    return int(time.time() * 1000)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def topic_matches(pattern: str, topic: str) -> bool:
    """MQTT-style ``+`` (single segment) and ``#`` (remainder; must be last) wildcards."""

    p = pattern.split("/")
    t = topic.split("/")

    def dfs(i: int, j: int) -> bool:
        if i == len(p) and j == len(t):
            return True
        if i == len(p):
            return False
        if p[i] == "#":
            return i == len(p) - 1
        if j == len(t):
            return False
        if p[i] == "+":
            return dfs(i + 1, j + 1)
        if p[i] == t[j]:
            return dfs(i + 1, j + 1)
        return False

    return dfs(0, 0)


class IoTTopic(str, Enum):
    """Relative topic segments under ``swarm/{swarm_id}/`` (see :class:`IoTTopicBuilder`)."""

    TELEMETRY = "iot/telemetry"
    COMMAND = "iot/command"
    COMMAND_RESULT = "iot/command/result"
    HEALTH = "iot/health"
    REGISTRY = "iot/registry"
    GEOFENCE = "iot/geofence"
    ALERTS = "iot/alerts"


class CommandType(str, Enum):
    TAKEOFF = "takeoff"
    LAND = "land"
    HOVER = "hover"
    GOTO = "goto"
    ESTOP = "estop"
    SYNC_STATE = "sync_state"
    REQUEST_HEALTH = "request_health"


@dataclass(slots=True)
class MissionAllocation:
    mission_id: str
    target_id: str
    assigned_device: str
    score: float
    reason: str


@dataclass(slots=True)
class EdgeCommandResult:
    command_id: str
    ok: bool
    result: dict[str, Any]
    error: str | None = None
    ts_ms: int = field(default_factory=current_time_ms)

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"command_id": self.command_id, "ok": self.ok, "result": self.result, "ts_ms": self.ts_ms}
        if self.error is not None:
            d["error"] = self.error
        return d

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> EdgeCommandResult:
        return cls(
            command_id=str(d["command_id"]),
            ok=bool(d["ok"]),
            result=dict(d.get("result", {})),
            error=d.get("error"),
            ts_ms=int(d.get("ts_ms", current_time_ms())),
        )


@dataclass(slots=True)
class EdgeCommand:
    command_id: str
    command: CommandType
    target_id: str
    requester_id: str
    args: dict[str, Any] = field(default_factory=dict)
    ts_ms: int = field(default_factory=current_time_ms)
    ttl: int = 3
    urgent: bool = False
    expect_ack: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "command_id": self.command_id,
            "command": self.command.value,
            "target_id": self.target_id,
            "requester_id": self.requester_id,
            "args": dict(self.args),
            "ts_ms": self.ts_ms,
            "ttl": self.ttl,
            "urgent": self.urgent,
            "expect_ack": self.expect_ack,
        }

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> EdgeCommand:
        return cls(
            command_id=str(d.get("command_id", f"cmd-{random.getrandbits(32):08x}")),
            command=CommandType(str(d.get("command", CommandType.REQUEST_HEALTH.value))),
            target_id=str(d.get("target_id", "")),
            requester_id=str(d.get("requester_id", "")),
            args=dict(d.get("args", {})),
            ts_ms=int(d.get("ts_ms", current_time_ms())),
            ttl=int(d.get("ttl", 3)),
            urgent=bool(d.get("urgent", False)),
            expect_ack=bool(d.get("expect_ack", True)),
        )


@dataclass(slots=True)
class IoTEnvelope:
    message_id: str
    device_id: str
    topic: str
    kind: str
    payload: dict[str, Any]
    ts_ms: int
    signature: str | None = None
    sequence: int | None = None
    qos: int = 2
    retain: bool = False
    ttl: int | None = None
    correlation_id: str | None = None
    reply_to: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "message_id": self.message_id,
            "device_id": self.device_id,
            "topic": self.topic,
            "kind": self.kind,
            "payload": self.payload,
            "ts_ms": self.ts_ms,
            "signature": self.signature,
            "qos": self.qos,
            "retain": self.retain,
        }
        if self.sequence is not None:
            d["sequence"] = self.sequence
        if self.ttl is not None:
            d["ttl"] = self.ttl
        if self.correlation_id is not None:
            d["correlation_id"] = self.correlation_id
        if self.reply_to is not None:
            d["reply_to"] = self.reply_to
        return d

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), sort_keys=True)

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> IoTEnvelope:
        seq = d.get("sequence", None)
        return cls(
            message_id=str(d["message_id"]),
            device_id=str(d["device_id"]),
            topic=str(d["topic"]),
            kind=str(d["kind"]),
            payload=dict(d["payload"]),
            ts_ms=int(d["ts_ms"]),
            signature=d.get("signature"),
            sequence=int(seq) if seq is not None else None,
            qos=int(d.get("qos", 2)),
            retain=bool(d.get("retain", False)),
            ttl=int(d["ttl"]) if d.get("ttl") is not None else None,
            correlation_id=d.get("correlation_id"),
            reply_to=d.get("reply_to"),
        )

    @classmethod
    def from_json(cls, raw: str) -> IoTEnvelope:
        return cls.from_dict(json.loads(raw))


class IoTSigner:
    def __init__(self, secret: bytes) -> None:
        self._secret = secret

    def _canonical(self, env: IoTEnvelope) -> bytes:
        body: dict[str, Any] = {
            "message_id": env.message_id,
            "device_id": env.device_id,
            "topic": env.topic,
            "kind": env.kind,
            "payload": env.payload,
            "ts_ms": env.ts_ms,
        }
        if env.sequence is not None:
            body["sequence"] = env.sequence
        return json.dumps(body, sort_keys=True, separators=(",", ":")).encode()

    def sign(self, env: IoTEnvelope) -> str:
        return hmac.new(self._secret, self._canonical(env), hashlib.sha256).hexdigest()

    def verify(self, env: IoTEnvelope, signature: str | None) -> bool:
        if signature is None:
            return False
        return hmac.compare_digest(self.sign(env), signature)


class IoTEnvelopeGuard:
    """Validates HMAC signature and optionally wall-clock skew + replay suppression."""

    def __init__(
        self,
        signer: IoTSigner,
        *,
        max_clock_skew_ms: int | None = None,
        dedup_max: int = 0,
    ) -> None:
        self._signer = signer
        self._max_clock_skew_ms = max_clock_skew_ms
        self._dedup_max = dedup_max
        self._seen_ids: Deque[str] = deque(maxlen=dedup_max if dedup_max > 0 else 1)
        self._seen_set: set[str] = set()
        self._dedup_lock = threading.Lock()

    def verify(self, env: IoTEnvelope) -> bool:
        if not self._signer.verify(env, env.signature):
            return False
        if self._max_clock_skew_ms is not None:
            if abs(current_time_ms() - env.ts_ms) > self._max_clock_skew_ms:
                return False
        if self._dedup_max > 0:
            with self._dedup_lock:
                if env.message_id in self._seen_set:
                    return False
                if len(self._seen_ids) == self._dedup_max:
                    oldest = self._seen_ids.popleft()
                    self._seen_set.discard(oldest)
                self._seen_ids.append(env.message_id)
                self._seen_set.add(env.message_id)
        return True


@dataclass(slots=True)
class Position3D:
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0

    def to_dict(self) -> dict[str, float]:
        return {"x": self.x, "y": self.y, "z": self.z}

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> Position3D:
        return cls(x=float(data.get("x", 0.0)), y=float(data.get("y", 0.0)), z=float(data.get("z", 0.0)))


@dataclass(slots=True)
class BatteryState:
    pct: float = 100.0
    voltage: float = 0.0
    critical: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {"pct": self.pct, "voltage": self.voltage, "critical": self.critical}

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> BatteryState:
        return cls(
            pct=float(data.get("pct", 100.0)),
            voltage=float(data.get("voltage", 0.0)),
            critical=bool(data.get("critical", False)),
        )


@dataclass(slots=True)
class DroneTelemetry:
    device_id: str
    timestamp_ms: int = field(default_factory=current_time_ms)
    position: Position3D = field(default_factory=Position3D)
    velocity: dict[str, float] = field(default_factory=dict)
    battery: BatteryState = field(default_factory=BatteryState)
    mode: str = "idle"
    mission_id: str = ""
    role: str = "standby"
    link_quality: float = 1.0
    extras: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "device_id": self.device_id,
            "timestamp_ms": self.timestamp_ms,
            "position": self.position.to_dict(),
            "velocity": dict(self.velocity),
            "battery": self.battery.to_dict(),
            "mode": self.mode,
            "mission_id": self.mission_id,
            "role": self.role,
            "link_quality": self.link_quality,
            "extras": dict(self.extras),
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> DroneTelemetry:
        return cls(
            device_id=str(data.get("device_id", "")),
            timestamp_ms=int(data.get("timestamp_ms", current_time_ms())),
            position=Position3D.from_dict(data.get("position", {}) or {}),
            velocity={k: float(v) for k, v in dict(data.get("velocity", {})).items()} if data.get("velocity") else {},
            battery=BatteryState.from_dict(data.get("battery", {}) or {}),
            mode=str(data.get("mode", "idle")),
            mission_id=str(data.get("mission_id", "")),
            role=str(data.get("role", "standby")),
            link_quality=float(data.get("link_quality", 1.0)),
            extras=dict(data.get("extras", {})),
        )


class JSONStore:
    """Atomic JSON read/write for registry and offline queues."""

    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()

    def load(self, default: dict[str, Any] | None = None) -> dict[str, Any]:
        if default is None:
            default = {}
        if not self.path.exists():
            return dict(default)
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            LOG.exception("failed to load JSON store: %s", self.path)
            return dict(default)

    def save(self, data: dict[str, Any]) -> None:
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        with self._lock:
            tmp.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
            tmp.replace(self.path)


@dataclass(slots=True)
class BufferedPacket:
    topic: str
    payload: str
    qos: int
    retain: bool = False
    created_at_ms: int = field(default_factory=current_time_ms)
    attempts: int = 0
    next_attempt_ms: int = field(default_factory=current_time_ms)
    priority: int = 0


class OfflinePacketBuffer:
    def __init__(self, path: Path, *, max_items: int = 5000) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.max_items = max_items
        self._lock = threading.RLock()
        self._queue: Deque[BufferedPacket] = deque()
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            for item in data:
                self._queue.append(BufferedPacket(**item))
        except Exception:
            LOG.exception("could not load packet buffer: %s", self.path)

    def _save_unlocked(self) -> None:
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps([asdict(item) for item in self._queue], indent=2, sort_keys=True), encoding="utf-8")
        tmp.replace(self.path)

    def push(self, item: BufferedPacket) -> None:
        with self._lock:
            while len(self._queue) >= self.max_items:
                self._queue.popleft()
            self._queue.append(item)
            self._save_unlocked()

    def pop_ready(self, now_ms: int | None = None, limit: int = 100) -> list[BufferedPacket]:
        now_ms = now_ms or current_time_ms()
        ready: list[BufferedPacket] = []
        with self._lock:
            keep: Deque[BufferedPacket] = deque()
            while self._queue:
                pkt = self._queue.popleft()
                if len(ready) < limit and pkt.next_attempt_ms <= now_ms:
                    ready.append(pkt)
                else:
                    keep.append(pkt)
            self._queue = keep
            if ready:
                self._save_unlocked()
        return ready

    def requeue(self, pkt: BufferedPacket, *, backoff_ms: int) -> None:
        pkt.attempts += 1
        pkt.next_attempt_ms = current_time_ms() + backoff_ms
        self.push(pkt)

    def __len__(self) -> int:
        with self._lock:
            return len(self._queue)


@dataclass(slots=True)
class RegistryEntry:
    device_id: str
    first_seen_ms: int = field(default_factory=current_time_ms)
    last_seen_ms: int = field(default_factory=current_time_ms)
    online: bool = True
    battery_pct: float = 100.0
    role: str = "standby"
    mission_id: str = ""
    location: dict[str, float] = field(default_factory=dict)
    capabilities: list[str] = field(default_factory=list)

    def touch_from_telemetry(self, telem: DroneTelemetry) -> None:
        self.last_seen_ms = telem.timestamp_ms
        self.online = True
        self.battery_pct = telem.battery.pct
        self.role = telem.role
        self.mission_id = telem.mission_id
        self.location = telem.position.to_dict()
        caps = telem.extras.get("capabilities")
        if isinstance(caps, list):
            self.capabilities = sorted(set(self.capabilities) | {str(c) for c in caps})


class DeviceRegistry:
    def __init__(self, store: JSONStore | None = None) -> None:
        self.store = store
        self._lock = threading.RLock()
        self._devices: dict[str, RegistryEntry] = {}
        if store is not None:
            self._load()

    def _load(self) -> None:
        assert self.store is not None
        data = self.store.load({"devices": {}})
        with self._lock:
            for device_id, payload in data.get("devices", {}).items():
                p = dict(payload)
                p["device_id"] = device_id
                self._devices[device_id] = RegistryEntry(**{k: p[k] for k in RegistryEntry.__dataclass_fields__ if k in p})

    def _persist_unlocked(self) -> None:
        if self.store is None:
            return
        payload = {"devices": {did: asdict(e) for did, e in self._devices.items()}}
        self.store.save(payload)

    def upsert(self, entry: RegistryEntry) -> RegistryEntry:
        with self._lock:
            self._devices[entry.device_id] = entry
            self._persist_unlocked()
        return entry

    def update_from_telemetry(self, telem: DroneTelemetry) -> RegistryEntry:
        with self._lock:
            entry = self._devices.get(telem.device_id)
            if entry is None:
                entry = RegistryEntry(device_id=telem.device_id, first_seen_ms=telem.timestamp_ms, last_seen_ms=telem.timestamp_ms)
            entry.touch_from_telemetry(telem)
            self._devices[telem.device_id] = entry
            self._persist_unlocked()
            return entry

    def get(self, device_id: str) -> RegistryEntry | None:
        with self._lock:
            return self._devices.get(device_id)

    def list_online(self) -> list[RegistryEntry]:
        with self._lock:
            return [e for e in self._devices.values() if e.online]

    def mark_offline(self, device_id: str) -> None:
        with self._lock:
            if device_id in self._devices:
                self._devices[device_id].online = False
                self._devices[device_id].last_seen_ms = current_time_ms()
            self._persist_unlocked()


class IoTTopicBuilder:
    """``swarm/{swarm_id}/iot/device/{device_id}/…`` layout (MQTT wildcards compatible)."""

    def __init__(self, swarm_id: str) -> None:
        self.swarm_id = swarm_id

    def base(self) -> str:
        return f"swarm/{self.swarm_id}/iot"

    def device(self, device_id: str) -> str:
        return f"{self.base()}/device/{device_id}"

    def telemetry(self, device_id: str) -> str:
        return f"{self.base()}/device/{device_id}/telemetry"

    def sensors(self, device_id: str) -> str:
        return f"{self.base()}/device/{device_id}/sensor"

    def commands(self, device_id: str) -> str:
        return f"{self.base()}/device/{device_id}/command"

    def results(self, device_id: str) -> str:
        return f"{self.base()}/device/{device_id}/command/result"

    def health(self, device_id: str) -> str:
        return f"{self.base()}/device/{device_id}/health"

    def registry(self) -> str:
        return f"{self.base()}/registry"

    def geofence(self) -> str:
        return f"{self.base()}/geofence"

    def alerts(self) -> str:
        return f"{self.base()}/alerts"


@dataclass(slots=True)
class FusionSample:
    source_id: str
    sensor_type: str
    value: Any
    weight: float = 1.0
    confidence: float = 1.0
    ts_ms: int = field(default_factory=current_time_ms)


@dataclass(slots=True)
class FusionResult:
    key: str
    fused_value: Any
    confidence: float
    contributors: list[str]
    sensor_type: str
    ts_ms: int = field(default_factory=current_time_ms)

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "fused_value": self.fused_value,
            "confidence": self.confidence,
            "contributors": list(self.contributors),
            "sensor_type": self.sensor_type,
            "ts_ms": self.ts_ms,
        }


class SensorFusionEngine:
    """Tiny weighted fusion for numeric samples keyed by sensor type or logical key."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._samples: DefaultDict[str, list[FusionSample]] = defaultdict(list)

    def ingest(self, key: str, sample: FusionSample) -> None:
        with self._lock:
            self._samples[key].append(sample)

    def fuse_numeric(self, key: str) -> FusionResult | None:
        with self._lock:
            samples = list(self._samples.get(key, []))
        if not samples:
            return None
        weighted = 0.0
        tw = 0.0
        contrib: list[str] = []
        for s in samples:
            try:
                v = float(s.value)
            except (TypeError, ValueError):
                continue
            w = max(0.1, s.weight * s.confidence)
            weighted += v * w
            tw += w
            contrib.append(s.source_id)
        if tw <= 0:
            return None
        fused = weighted / tw
        conf = clamp(tw / max(len(samples), 1), 0.0, 1.0)
        return FusionResult(key=key, fused_value=fused, confidence=conf, contributors=sorted(set(contrib)), sensor_type="numeric")

    def summary(self) -> dict[str, Any]:
        with self._lock:
            return {"keys": list(self._samples.keys()), "sample_count": sum(len(v) for v in self._samples.values())}


@dataclass(slots=True)
class GeoFence:
    fence_id: str
    name: str
    points: list[Position3D]
    min_alt_m: float = 0.0
    max_alt_m: float = 120.0
    enabled: bool = True

    def contains(self, point: Position3D) -> bool:
        if point.z < self.min_alt_m or point.z > self.max_alt_m:
            return False
        if len(self.points) < 3:
            return True
        x, y = point.x, point.y
        inside = False
        j = len(self.points) - 1
        for i in range(len(self.points)):
            xi, yi = self.points[i].x, self.points[i].y
            xj, yj = self.points[j].x, self.points[j].y
            denom = (yj - yi) if (yj - yi) != 0 else 1e-9
            intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / denom + xi)
            if intersect:
                inside = not inside
            j = i
        return inside

    def to_dict(self) -> dict[str, Any]:
        return {
            "fence_id": self.fence_id,
            "name": self.name,
            "points": [p.to_dict() for p in self.points],
            "min_alt_m": self.min_alt_m,
            "max_alt_m": self.max_alt_m,
            "enabled": self.enabled,
        }


class GeoFenceManager:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._fences: dict[str, GeoFence] = {}

    def add(self, fence: GeoFence) -> None:
        with self._lock:
            self._fences[fence.fence_id] = fence

    def check_violations(self, position: Position3D) -> list[GeoFence]:
        with self._lock:
            return [f for f in self._fences.values() if f.enabled and not f.contains(position)]

    def list(self) -> list[GeoFence]:
        with self._lock:
            return list(self._fences.values())


class MissionAllocator:
    def __init__(self, registry: DeviceRegistry) -> None:
        self.registry = registry
        self._lock = threading.RLock()
        self._allocations: dict[str, MissionAllocation] = {}

    def allocate(self, mission_id: str, target_id: str, requirements: dict[str, Any]) -> MissionAllocation | None:
        min_b = float(requirements.get("min_battery_pct", 0.0))
        needed = [str(x) for x in requirements.get("capabilities", [])]
        best: tuple[float, RegistryEntry] | None = None
        for entry in self.registry.list_online():
            if entry.battery_pct < min_b:
                continue
            if needed and not set(needed).issubset(set(entry.capabilities)):
                continue
            score = float(entry.battery_pct) * 0.6 + float(len(entry.capabilities))
            t = (score, entry)
            if best is None or t[0] > best[0]:
                best = t
        if best is None:
            return None
        score, entry = best
        alloc = MissionAllocation(
            mission_id=mission_id,
            target_id=target_id,
            assigned_device=entry.device_id,
            score=float(score),
            reason="battery_and_caps",
        )
        with self._lock:
            self._allocations[target_id] = alloc
        return alloc


class EdgeCommandQueue:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._pending: dict[str, EdgeCommand] = {}
        self._responses: dict[str, EdgeCommandResult] = {}
        self._events: DefaultDict[str, threading.Event] = defaultdict(threading.Event)

    def add(self, command: EdgeCommand) -> None:
        with self._lock:
            self._pending[command.command_id] = command

    def respond(self, result: EdgeCommandResult) -> None:
        with self._lock:
            self._responses[result.command_id] = result
            self._events[result.command_id].set()
            self._pending.pop(result.command_id, None)

    def wait_for(self, command_id: str, timeout_s: float = 5.0) -> EdgeCommandResult | None:
        ev = self._events[command_id]
        if not ev.wait(timeout_s):
            return None
        with self._lock:
            return self._responses.get(command_id)


class SwarmIoTBridge:
    """Publish signed IoT envelopes and ingest peer telemetry into a local registry."""

    def __init__(
        self,
        swarm_id: str,
        node_id: str,
        state_store: Any,
        client: Any,
        *,
        persistence_dir: str | Path | None = None,
        secret: bytes | None = None,
    ) -> None:
        self.swarm_id = swarm_id
        self.node_id = node_id
        self.state_store = state_store
        self.client = client
        self.topics = IoTTopicBuilder(swarm_id)
        self.signer: IoTSigner | None = IoTSigner(secret) if secret is not None else None
        self.guard: IoTEnvelopeGuard | None = None
        self.registry = DeviceRegistry(JSONStore(Path(persistence_dir) / f"{swarm_id}.registry.json") if persistence_dir else None)
        self.packet_buffer = OfflinePacketBuffer(Path(persistence_dir) / f"{swarm_id}.{node_id}.buffer.json") if persistence_dir else None
        self.fusion = SensorFusionEngine()
        self.geofences = GeoFenceManager()
        self.allocator = MissionAllocator(self.registry)
        self.commands = EdgeCommandQueue()
        self._seq = 0
        self._seq_lock = threading.Lock()

    def next_sequence(self) -> int:
        with self._seq_lock:
            self._seq += 1
            return self._seq

    def build_envelope(self, kind: str, topic: str, payload: dict[str, Any], *, sequence: int | None = None) -> IoTEnvelope:
        seq = self.next_sequence() if sequence is None else sequence
        env = IoTEnvelope(
            message_id=f"{self.node_id}:{kind}:{seq}:{random.getrandbits(32):08x}",
            device_id=self.node_id,
            topic=topic,
            kind=kind,
            payload=payload,
            ts_ms=current_time_ms(),
            sequence=seq,
        )
        if self.signer is not None:
            env.signature = self.signer.sign(env)
        return env

    def publish_envelope(self, env: IoTEnvelope, *, offline_ok: bool = True) -> str | Any:
        raw = env.to_json()
        try:
            return self.client.publish(env.topic, raw, qos=getattr(env, "qos", 2), retain=getattr(env, "retain", False))
        except Exception:
            LOG.debug("publish failed, queueing offline", exc_info=True)
            if not offline_ok or self.packet_buffer is None:
                raise
            self.packet_buffer.push(
                BufferedPacket(topic=env.topic, payload=raw, qos=int(getattr(env, "qos", 2)), retain=bool(getattr(env, "retain", False)))
            )
            return env.message_id

    def publish_telemetry(self, telem: DroneTelemetry) -> str | Any:
        self.registry.update_from_telemetry(telem)
        topic = self.topics.telemetry(telem.device_id)
        env = self.build_envelope("telemetry", topic, telem.to_dict())
        return self.publish_envelope(env)

    def publish_command(self, cmd: EdgeCommand) -> str | Any:
        self.commands.add(cmd)
        topic = self.topics.commands(cmd.target_id)
        env = self.build_envelope("command", topic, cmd.to_dict(), sequence=self.next_sequence())
        env.correlation_id = cmd.command_id
        env.reply_to = self.topics.results(cmd.requester_id)
        if self.signer is not None:
            env.signature = self.signer.sign(env)
        return self.publish_envelope(env)

    def flush_offline(self) -> int:
        if self.packet_buffer is None:
            return 0
        n = 0
        connected = getattr(self.client, "_connected", None)
        if connected is not None and hasattr(connected, "is_set") and not connected.is_set():
            return 0
        for pkt in self.packet_buffer.pop_ready(limit=50):
            try:
                self.client.publish(pkt.topic, pkt.payload, qos=pkt.qos, retain=pkt.retain)
                n += 1
            except Exception:
                self.packet_buffer.requeue(pkt, backoff_ms=min(8000, 500 * (2 ** min(pkt.attempts, 6))))
        return n

    def handle_incoming(self, raw: str) -> dict[str, Any] | None:
        try:
            env = IoTEnvelope.from_json(raw)
        except Exception:
            return None
        if self.guard is None or not self.guard.verify(env):
            return None
        if env.kind == "command_result":
            try:
                self.commands.respond(EdgeCommandResult.from_dict(env.payload))
            except Exception:
                LOG.debug("command_result parse failed", exc_info=True)
            return {"command_result": "accepted"}
        if env.kind == "telemetry":
            telem = DroneTelemetry.from_dict(env.payload)
            self.registry.update_from_telemetry(telem)
            viol = self.geofences.check_violations(telem.position)
            return {"telemetry": True, "geofence_violations": [f.fence_id for f in viol]}
        if env.kind == "command":
            cmd = EdgeCommand.from_dict(env.payload)
            if cmd.command is CommandType.REQUEST_HEALTH:
                entry = self.registry.get(cmd.target_id)
                ok = entry is not None
                res = EdgeCommandResult(command_id=cmd.command_id, ok=ok, result={"registry": asdict(entry)} if entry else {}, error=None if ok else "unknown_device")
                if cmd.expect_ack:
                    ack = self.build_envelope("command_result", self.topics.results(self.node_id), res.to_dict())
                    if self.signer is not None:
                        ack.signature = self.signer.sign(ack)
                    self.publish_envelope(ack, offline_ok=True)
                return {"command": cmd.command.value, "ok": ok}
        return {"kind": env.kind, "accepted": True}


def iot_smoke_demo() -> dict[str, Any]:
    class _Mem:
        def __init__(self) -> None:
            self.published_count = 0

        def publish(self, *_a: object, **_k: object) -> str:
            self.published_count += 1
            return "ok"

        def subscribe(self, *_a: object, **_k: object) -> None:
            return None

    mem = _Mem()
    secret = b"\x01" * 32
    bridge = SwarmIoTBridge(
        swarm_id="s",
        node_id="n1",
        state_store=type("_S", (), {"role": "r"})(),
        client=mem,
        secret=secret,
    )
    bridge.guard = IoTEnvelopeGuard(IoTSigner(secret))
    topic = bridge.topics.telemetry("n1")
    for i in range(3):
        env = bridge.build_envelope("telemetry", topic, {"v": i}, sequence=i)
        mem.publish(topic, env.to_json())
    return {"published_count": mem.published_count, "topic": topic}