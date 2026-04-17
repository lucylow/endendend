"""IoT features for a drone swarm (FoxMQ / Vertex-friendly).

Telemetry ingestion, signed envelopes, device registry and capability hints,
sensor fusion, geofencing and safety signals, battery-aware allocation helpers,
health rollups, offline buffering, and MQTT-style topics. Intended to sit
beside ``swarm.foxmq_integration`` and higher-level controllers without
replacing them.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import math
import random
import threading
import time
from collections import defaultdict, deque
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, DefaultDict, Deque, Mapping, Sequence

try:  # pragma: no cover - optional dependency
    import paho.mqtt.client as mqtt
except Exception:  # pragma: no cover - optional dependency
    mqtt = None  # type: ignore[assignment,misc]

LOG = logging.getLogger(__name__)


def current_time_ms() -> int:
    return int(time.time() * 1000)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def euclidean_distance(a: Mapping[str, float], b: Mapping[str, float]) -> float:
    ax, ay, az = float(a.get("x", 0.0)), float(a.get("y", 0.0)), float(a.get("z", 0.0))
    bx, by, bz = float(b.get("x", 0.0)), float(b.get("y", 0.0)), float(b.get("z", 0.0))
    return math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2)


def manhattan_distance(a: Mapping[str, float], b: Mapping[str, float]) -> float:
    ax, ay, az = float(a.get("x", 0.0)), float(a.get("y", 0.0)), float(a.get("z", 0.0))
    bx, by, bz = float(b.get("x", 0.0)), float(b.get("y", 0.0)), float(b.get("z", 0.0))
    return abs(ax - bx) + abs(ay - by) + abs(az - bz)


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
    TELEMETRY_RAW = "iot/telemetry/raw"
    TELEMETRY_AGG = "iot/telemetry/agg"
    COMMAND = "iot/command"
    COMMAND_ACK = "iot/command/ack"
    COMMAND_RESULT = "iot/command/result"
    SENSOR = "iot/sensor"
    SENSOR_FUSION = "iot/sensor/fusion"
    HEALTH = "iot/health"
    REGISTRY = "iot/registry"
    GEOFENCE = "iot/geofence"
    SAFETY = "iot/safety"
    MISSION = "iot/mission"
    MISSION_EVENT = "iot/mission/event"
    ALERTS = "iot/alerts"
    PAYLOAD = "iot/payload"
    ACTUATOR = "iot/actuator"


class DeviceType(str, Enum):
    DRONE = "drone"
    ROVER = "rover"
    STATION = "station"
    RELAY = "relay"
    CAMERA = "camera"
    SENSOR_NODE = "sensor_node"
    GATEWAY = "gateway"


class CommandType(str, Enum):
    TAKEOFF = "takeoff"
    LAND = "land"
    HOVER = "hover"
    GOTO = "goto"
    SET_SPEED = "set_speed"
    SET_ALTITUDE = "set_altitude"
    STREAM_ON = "stream_on"
    STREAM_OFF = "stream_off"
    LIGHT_ON = "light_on"
    LIGHT_OFF = "light_off"
    BUZZER_ON = "buzzer_on"
    BUZZER_OFF = "buzzer_off"
    GRIP_OPEN = "grip_open"
    GRIP_CLOSE = "grip_close"
    PAYLOAD_ARM = "payload_arm"
    PAYLOAD_DISARM = "payload_disarm"
    ESTOP = "estop"
    RETURN_HOME = "return_home"
    SYNC_STATE = "sync_state"
    REQUEST_HEALTH = "request_health"
    REQUEST_SENSOR = "request_sensor"


class TelemetryQuality(str, Enum):
    GOOD = "good"
    DEGRADED = "degraded"
    LOST = "lost"
    UNKNOWN = "unknown"


class FlightMode(str, Enum):
    BOOT = "boot"
    IDLE = "idle"
    TAKEOFF = "takeoff"
    CRUISE = "cruise"
    SEARCH = "search"
    HOVER = "hover"
    LANDING = "landing"
    RETURN_HOME = "return_home"
    EMERGENCY = "emergency"
    CHARGING = "charging"


@dataclass(slots=True)
class MissionAllocation:
    mission_id: str
    target_id: str
    assigned_device: str
    score: float
    reason: str
    created_at_ms: int = field(default_factory=current_time_ms)
    expires_at_ms: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


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
        cmd_raw = str(d.get("command", CommandType.REQUEST_HEALTH.value))
        try:
            cmd = CommandType(cmd_raw)
        except ValueError:
            cmd = CommandType.REQUEST_HEALTH
        return cls(
            command_id=str(d.get("command_id", f"cmd-{random.getrandbits(32):08x}")),
            command=cmd,
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
class Velocity3D:
    vx: float = 0.0
    vy: float = 0.0
    vz: float = 0.0

    def speed(self) -> float:
        return math.sqrt(self.vx**2 + self.vy**2 + self.vz**2)

    def to_dict(self) -> dict[str, float]:
        return {"vx": self.vx, "vy": self.vy, "vz": self.vz}

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> Velocity3D:
        return cls(
            vx=float(data.get("vx", 0.0)),
            vy=float(data.get("vy", 0.0)),
            vz=float(data.get("vz", 0.0)),
        )


@dataclass(slots=True)
class BatteryState:
    pct: float = 100.0
    voltage: float = 0.0
    current_a: float = 0.0
    temperature_c: float = 0.0
    charging: bool = False
    critical: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> BatteryState:
        return cls(
            pct=float(data.get("pct", 100.0)),
            voltage=float(data.get("voltage", 0.0)),
            current_a=float(data.get("current_a", 0.0)),
            temperature_c=float(data.get("temperature_c", 0.0)),
            charging=bool(data.get("charging", False)),
            critical=bool(data.get("critical", False)),
        )


@dataclass(slots=True)
class DroneTelemetry:
    device_id: str
    timestamp_ms: int = field(default_factory=current_time_ms)
    position: Position3D = field(default_factory=Position3D)
    velocity: Velocity3D = field(default_factory=Velocity3D)
    battery: BatteryState = field(default_factory=BatteryState)
    mode: FlightMode = FlightMode.IDLE
    cpu_pct: float = 0.0
    memory_pct: float = 0.0
    link_quality: float = 1.0
    gps_fix: bool = True
    heading_deg: float = 0.0
    temperature_c: float = 0.0
    altitude_m: float = 0.0
    mission_id: str = ""
    role: str = "standby"
    target_id: str | None = None
    health_flags: dict[str, Any] = field(default_factory=dict)
    extras: dict[str, Any] = field(default_factory=dict)

    def quality(self) -> TelemetryQuality:
        score = 1.0
        if self.link_quality < 0.2:
            score -= 0.5
        if self.battery.pct < 20:
            score -= 0.2
        if self.cpu_pct > 85:
            score -= 0.1
        if self.memory_pct > 85:
            score -= 0.1
        if not self.gps_fix:
            score -= 0.2
        if score >= 0.8:
            return TelemetryQuality.GOOD
        if score >= 0.5:
            return TelemetryQuality.DEGRADED
        if score > 0:
            return TelemetryQuality.LOST
        return TelemetryQuality.UNKNOWN

    def to_dict(self) -> dict[str, Any]:
        return {
            "device_id": self.device_id,
            "timestamp_ms": self.timestamp_ms,
            "position": self.position.to_dict(),
            "velocity": self.velocity.to_dict(),
            "battery": self.battery.to_dict(),
            "mode": self.mode.value,
            "cpu_pct": self.cpu_pct,
            "memory_pct": self.memory_pct,
            "link_quality": self.link_quality,
            "gps_fix": self.gps_fix,
            "heading_deg": self.heading_deg,
            "temperature_c": self.temperature_c,
            "altitude_m": self.altitude_m,
            "mission_id": self.mission_id,
            "role": self.role,
            "target_id": self.target_id,
            "health_flags": dict(self.health_flags),
            "extras": dict(self.extras),
            "quality": self.quality().value,
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> DroneTelemetry:
        raw_mode = data.get("mode", FlightMode.IDLE.value)
        try:
            mode = FlightMode(str(raw_mode))
        except ValueError:
            mode = FlightMode.IDLE
        vel_raw = data.get("velocity", {}) or {}
        return cls(
            device_id=str(data.get("device_id", "")),
            timestamp_ms=int(data.get("timestamp_ms", current_time_ms())),
            position=Position3D.from_dict(data.get("position", {}) or {}),
            velocity=Velocity3D.from_dict(vel_raw) if isinstance(vel_raw, Mapping) else Velocity3D(),
            battery=BatteryState.from_dict(data.get("battery", {}) or {}),
            mode=mode,
            cpu_pct=float(data.get("cpu_pct", 0.0)),
            memory_pct=float(data.get("memory_pct", 0.0)),
            link_quality=float(data.get("link_quality", 1.0)),
            gps_fix=bool(data.get("gps_fix", True)),
            heading_deg=float(data.get("heading_deg", 0.0)),
            temperature_c=float(data.get("temperature_c", 0.0)),
            altitude_m=float(data.get("altitude_m", 0.0)),
            mission_id=str(data.get("mission_id", "")),
            role=str(data.get("role", "standby")),
            target_id=data.get("target_id"),
            health_flags=dict(data.get("health_flags", {})),
            extras=dict(data.get("extras", {})),
        )


@dataclass(slots=True)
class SensorReading:
    sensor_id: str
    sensor_type: str
    value: Any
    unit: str = ""
    confidence: float = 1.0
    source_id: str = ""
    ts_ms: int = field(default_factory=current_time_ms)
    quality: TelemetryQuality = TelemetryQuality.UNKNOWN
    location: Position3D | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "sensor_id": self.sensor_id,
            "sensor_type": self.sensor_type,
            "value": self.value,
            "unit": self.unit,
            "confidence": self.confidence,
            "source_id": self.source_id,
            "ts_ms": self.ts_ms,
            "quality": self.quality.value,
            "metadata": dict(self.metadata),
        }
        if self.location is not None:
            d["location"] = self.location.to_dict()
        return d

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> SensorReading:
        loc = data.get("location")
        q = str(data.get("quality", TelemetryQuality.UNKNOWN.value))
        try:
            qual = TelemetryQuality(q)
        except ValueError:
            qual = TelemetryQuality.UNKNOWN
        return cls(
            sensor_id=str(data.get("sensor_id", "")),
            sensor_type=str(data.get("sensor_type", "generic")),
            value=data.get("value"),
            unit=str(data.get("unit", "")),
            confidence=float(data.get("confidence", 1.0)),
            source_id=str(data.get("source_id", "")),
            ts_ms=int(data.get("ts_ms", current_time_ms())),
            quality=qual,
            location=Position3D.from_dict(loc) if isinstance(loc, Mapping) else None,
            metadata=dict(data.get("metadata", {})),
        )


@dataclass(slots=True)
class DroneHealthReport:
    device_id: str
    status: str
    quality: TelemetryQuality
    battery_pct: float
    link_quality: float
    mission_id: str = ""
    role: str = "standby"
    active_alerts: list[dict[str, Any]] = field(default_factory=list)
    last_seen_ms: int = field(default_factory=current_time_ms)
    flight_mode: FlightMode = FlightMode.IDLE
    score: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["quality"] = self.quality.value
        d["flight_mode"] = self.flight_mode.value
        return d


class SafetyLevel(str, Enum):
    OK = "ok"
    WARN = "warn"
    STOP = "stop"
    RTH = "return_home"
    EMERGENCY = "emergency"


@dataclass(slots=True)
class SafetyEvent:
    event_id: str
    device_id: str
    level: SafetyLevel
    reason: str
    details: dict[str, Any] = field(default_factory=dict)
    position: Position3D | None = None
    ts_ms: int = field(default_factory=current_time_ms)
    resolved: bool = False

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "event_id": self.event_id,
            "device_id": self.device_id,
            "level": self.level.value,
            "reason": self.reason,
            "details": dict(self.details),
            "ts_ms": self.ts_ms,
            "resolved": self.resolved,
        }
        if self.position is not None:
            d["position"] = self.position.to_dict()
        return d


class SafetyController:
    def __init__(self, geofences: "GeoFenceManager") -> None:
        self.geofences = geofences
        self._lock = threading.RLock()
        self._events: Deque[SafetyEvent] = deque(maxlen=1000)

    def inspect(self, telemetry: DroneTelemetry) -> list[SafetyEvent]:
        events: list[SafetyEvent] = []
        violated = self.geofences.check_violations(telemetry.position)
        if violated:
            events.append(
                SafetyEvent(
                    event_id=f"safe-{random.getrandbits(32):08x}",
                    device_id=telemetry.device_id,
                    level=SafetyLevel.STOP,
                    reason="geofence_violation",
                    details={"violated": [f.fence_id for f in violated]},
                    position=telemetry.position,
                )
            )
        if telemetry.battery.critical or telemetry.battery.pct < 10:
            events.append(
                SafetyEvent(
                    event_id=f"safe-{random.getrandbits(32):08x}",
                    device_id=telemetry.device_id,
                    level=SafetyLevel.RTH,
                    reason="battery_low",
                    details={"battery_pct": telemetry.battery.pct},
                    position=telemetry.position,
                )
            )
        if telemetry.temperature_c > 80:
            events.append(
                SafetyEvent(
                    event_id=f"safe-{random.getrandbits(32):08x}",
                    device_id=telemetry.device_id,
                    level=SafetyLevel.EMERGENCY,
                    reason="temperature_high",
                    details={"temperature_c": telemetry.temperature_c},
                    position=telemetry.position,
                )
            )
        with self._lock:
            self._events.extend(events)
        return events

    def recent(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            return [e.to_dict() for e in list(self._events)[-limit:]]


class HealthScorer:
    def score(self, telemetry: DroneTelemetry, safety_events: Sequence[SafetyEvent] = ()) -> float:
        s = 100.0
        s -= max(0.0, 100.0 - telemetry.battery.pct)
        s -= telemetry.cpu_pct * 0.25
        s -= telemetry.memory_pct * 0.2
        s -= max(0.0, 1.0 - telemetry.link_quality) * 30.0
        if not telemetry.gps_fix:
            s -= 10.0
        if telemetry.battery.critical:
            s -= 35.0
        for ev in safety_events:
            if ev.level in {SafetyLevel.STOP, SafetyLevel.EMERGENCY}:
                s -= 25.0
            elif ev.level == SafetyLevel.RTH:
                s -= 10.0
            elif ev.level == SafetyLevel.WARN:
                s -= 5.0
        return clamp(s, 0.0, 100.0)

    def status(self, score: float) -> str:
        if score >= 80:
            return "healthy"
        if score >= 60:
            return "watch"
        if score >= 30:
            return "degraded"
        return "critical"


class FleetHealthMonitor:
    def __init__(self, scorer: HealthScorer | None = None) -> None:
        self.scorer = scorer or HealthScorer()
        self._lock = threading.RLock()
        self._latest: dict[str, DroneHealthReport] = {}

    def update(self, telemetry: DroneTelemetry, safety_events: Sequence[SafetyEvent] = ()) -> DroneHealthReport:
        sc = self.scorer.score(telemetry, safety_events)
        report = DroneHealthReport(
            device_id=telemetry.device_id,
            status=self.scorer.status(sc),
            quality=telemetry.quality(),
            battery_pct=telemetry.battery.pct,
            link_quality=telemetry.link_quality,
            mission_id=telemetry.mission_id,
            role=telemetry.role,
            active_alerts=[e.to_dict() for e in safety_events],
            last_seen_ms=telemetry.timestamp_ms,
            flight_mode=telemetry.mode,
            score=sc,
            metadata={
                "cpu_pct": telemetry.cpu_pct,
                "memory_pct": telemetry.memory_pct,
                "gps_fix": telemetry.gps_fix,
            },
        )
        with self._lock:
            self._latest[telemetry.device_id] = report
        return report

    def get(self, device_id: str) -> DroneHealthReport | None:
        with self._lock:
            return self._latest.get(device_id)

    def list(self) -> list[DroneHealthReport]:
        with self._lock:
            return sorted(self._latest.values(), key=lambda r: (r.score, r.last_seen_ms), reverse=True)

    def fleet_summary(self) -> dict[str, Any]:
        with self._lock:
            reports = list(self._latest.values())
        if not reports:
            return {"count": 0, "average_score": 0.0, "critical": 0, "degraded": 0, "healthy": 0}
        avg = sum(r.score for r in reports) / len(reports)
        return {
            "count": len(reports),
            "average_score": avg,
            "critical": sum(1 for r in reports if r.status == "critical"),
            "degraded": sum(1 for r in reports if r.status == "degraded"),
            "healthy": sum(1 for r in reports if r.status == "healthy"),
        }


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
    sticky_key: str = ""


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
                if "sticky_key" not in item:
                    item = {**item, "sticky_key": ""}
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


class TelemetryCache:
    """Ring buffer of telemetry frames for replay and last-known-good lookups."""

    def __init__(self, path: Path, *, max_items: int = 10_000) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.max_items = max_items
        self._lock = threading.RLock()
        self._entries: Deque[DroneTelemetry] = deque()
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            for item in data:
                self._entries.append(DroneTelemetry.from_dict(item))
        except Exception:
            LOG.exception("could not load telemetry cache")

    def _save_unlocked(self) -> None:
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps([e.to_dict() for e in self._entries], indent=2, sort_keys=True), encoding="utf-8")
        tmp.replace(self.path)

    def append(self, telem: DroneTelemetry) -> None:
        with self._lock:
            while len(self._entries) >= self.max_items:
                self._entries.popleft()
            self._entries.append(telem)
            self._save_unlocked()

    def list(self, limit: int = 100) -> list[DroneTelemetry]:
        with self._lock:
            return list(self._entries)[-limit:]

    def latest_for(self, device_id: str) -> DroneTelemetry | None:
        with self._lock:
            for e in reversed(self._entries):
                if e.device_id == device_id:
                    return e
        return None

    def summary(self) -> dict[str, Any]:
        with self._lock:
            return {"count": len(self._entries), "devices": sorted({e.device_id for e in self._entries})}


class TelemetryReplayer:
    def __init__(self, cache: TelemetryCache, callback: Callable[[DroneTelemetry], None]) -> None:
        self.cache = cache
        self.callback = callback

    def replay(self, limit: int = 100) -> int:
        n = 0
        for telem in self.cache.list(limit):
            self.callback(telem)
            n += 1
        return n


@dataclass(slots=True)
class RegistryEntry:
    device_id: str
    device_type: str = DeviceType.DRONE.value
    model: str = "generic"
    vendor: str = "unknown"
    first_seen_ms: int = field(default_factory=current_time_ms)
    last_seen_ms: int = field(default_factory=current_time_ms)
    online: bool = True
    battery_pct: float = 100.0
    role: str = "standby"
    mission_id: str = ""
    location: dict[str, float] = field(default_factory=dict)
    capabilities: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

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


@dataclass(slots=True)
class DroneCapability:
    device_id: str
    device_type: DeviceType = DeviceType.DRONE
    model: str = "generic"
    max_payload_kg: float = 0.0
    max_speed_mps: float = 0.0
    max_altitude_m: float = 120.0
    battery_capacity_mah: float = 0.0
    sensors: list[str] = field(default_factory=list)
    actuators: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    sw_version: str = "0.0.0"
    hw_version: str = "0.0.0"
    vendor: str = "unknown"
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_registry_entry(self) -> RegistryEntry:
        caps = sorted(set(self.sensors + self.actuators + self.tags))
        return RegistryEntry(
            device_id=self.device_id,
            device_type=self.device_type.value,
            model=self.model,
            vendor=self.vendor,
            capabilities=caps,
            tags=list(self.tags),
            metadata=dict(self.metadata),
            online=True,
        )


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

    def list(self) -> list[RegistryEntry]:
        with self._lock:
            return sorted(self._devices.values(), key=lambda d: (d.online, d.last_seen_ms), reverse=True)

    def online_devices(self) -> list[RegistryEntry]:
        return [d for d in self.list() if d.online]

    def remove(self, device_id: str) -> bool:
        with self._lock:
            ok = self._devices.pop(device_id, None) is not None
        if ok:
            self._persist_unlocked()
        return ok

    def register_capability(self, capability: DroneCapability) -> RegistryEntry:
        return self.upsert(capability.to_registry_entry())

    def score_device(self, entry: RegistryEntry, requirements: dict[str, Any]) -> float:
        score = 0.0
        want_dt = requirements.get("device_type")
        if want_dt and str(want_dt) == entry.device_type:
            score += 40.0
        for cap in requirements.get("capabilities", []):
            if str(cap) in entry.capabilities:
                score += 10.0
        min_b = float(requirements.get("min_battery_pct", 0.0))
        if entry.battery_pct >= min_b:
            score += min(20.0, entry.battery_pct / 5.0)
        role = requirements.get("role")
        if role and role == entry.role:
            score += 15.0
        if entry.online:
            score += 10.0
        return score

    def best_device_for_task(self, requirements: dict[str, Any]) -> RegistryEntry | None:
        ranked: list[tuple[float, RegistryEntry]] = []
        for entry in self.online_devices():
            ranked.append((self.score_device(entry, requirements), entry))
        if not ranked:
            return None
        ranked.sort(key=lambda t: (t[0], t[1].battery_pct, t[1].device_id), reverse=True)
        return ranked[0][1]

    def stale_devices(self, stale_after_s: float = 20.0) -> list[RegistryEntry]:
        now = current_time_ms()
        return [e for e in self.list() if (now - e.last_seen_ms) / 1000.0 > stale_after_s]


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

    def mission(self, mission_id: str) -> str:
        return f"{self.base()}/mission/{mission_id}"


@dataclass(slots=True)
class FusionSample:
    source_id: str
    sensor_type: str
    value: Any
    weight: float = 1.0
    confidence: float = 1.0
    ts_ms: int = field(default_factory=current_time_ms)
    location: Position3D | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class FusionResult:
    key: str
    fused_value: Any
    confidence: float
    contributors: list[str]
    sensor_type: str
    ts_ms: int = field(default_factory=current_time_ms)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "fused_value": self.fused_value,
            "confidence": self.confidence,
            "contributors": list(self.contributors),
            "sensor_type": self.sensor_type,
            "ts_ms": self.ts_ms,
            "metadata": dict(self.metadata),
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

    def fuse_boolean(self, key: str) -> FusionResult | None:
        with self._lock:
            samples = list(self._samples.get(key, []))
        if not samples:
            return None
        score = 0.0
        tw = 0.0
        contrib: list[str] = []
        for s in samples:
            w = max(0.1, s.weight * s.confidence)
            score += (1.0 if bool(s.value) else -1.0) * w
            tw += w
            contrib.append(s.source_id)
        fused = score >= 0
        conf = clamp(abs(score) / max(tw, 1e-9), 0.0, 1.0)
        return FusionResult(key=key, fused_value=fused, confidence=conf, contributors=sorted(set(contrib)), sensor_type="boolean")

    def fuse_location(self, key: str) -> FusionResult | None:
        with self._lock:
            samples = [s for s in self._samples.get(key, []) if s.location is not None]
        if not samples:
            return None
        wx = wy = wz = tw = 0.0
        contrib: list[str] = []
        for s in samples:
            assert s.location is not None
            w = max(0.1, s.weight * s.confidence)
            wx += s.location.x * w
            wy += s.location.y * w
            wz += s.location.z * w
            tw += w
            contrib.append(s.source_id)
        if tw <= 0:
            return None
        fused = Position3D(x=wx / tw, y=wy / tw, z=wz / tw)
        return FusionResult(
            key=key,
            fused_value=fused.to_dict(),
            confidence=clamp(tw / max(len(samples), 1), 0.0, 1.0),
            contributors=sorted(set(contrib)),
            sensor_type="location",
        )

    def clear(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._samples.clear()
            else:
                self._samples.pop(key, None)

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
    emergency_exit: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)

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
            "emergency_exit": self.emergency_exit,
            "metadata": dict(self.metadata),
        }


class GeoFenceManager:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._fences: dict[str, GeoFence] = {}

    def add(self, fence: GeoFence) -> None:
        with self._lock:
            self._fences[fence.fence_id] = fence

    def remove(self, fence_id: str) -> bool:
        with self._lock:
            return self._fences.pop(fence_id, None) is not None

    def get(self, fence_id: str) -> GeoFence | None:
        with self._lock:
            return self._fences.get(fence_id)

    def check_violations(self, position: Position3D) -> list[GeoFence]:
        with self._lock:
            return [f for f in self._fences.values() if f.enabled and not f.emergency_exit and not f.contains(position)]

    def list(self) -> list[GeoFence]:
        with self._lock:
            return list(self._fences.values())

    def summary(self) -> dict[str, Any]:
        fs = self.list()
        return {"count": len(fs), "enabled": sum(1 for f in fs if f.enabled)}


class MissionAllocator:
    def __init__(self, registry: DeviceRegistry) -> None:
        self.registry = registry
        self._lock = threading.RLock()
        self._allocations: dict[str, MissionAllocation] = {}

    def allocate(self, mission_id: str, target_id: str, requirements: dict[str, Any]) -> MissionAllocation | None:
        entry = self.registry.best_device_for_task(requirements)
        if entry is None:
            return None
        score = self.registry.score_device(entry, requirements)
        ttl_ms = int(float(requirements.get("ttl_s", 60)) * 1000)
        reason = f"best_device score={score:.2f} battery={entry.battery_pct:.1f} role={entry.role}"
        alloc = MissionAllocation(
            mission_id=mission_id,
            target_id=target_id,
            assigned_device=entry.device_id,
            score=float(score),
            reason=reason,
            expires_at_ms=current_time_ms() + ttl_ms,
            metadata=dict(requirements.get("allocation_metadata", {})),
        )
        with self._lock:
            self._allocations[target_id] = alloc
        return alloc

    def expire(self) -> list[str]:
        now = current_time_ms()
        expired: list[str] = []
        with self._lock:
            for tid, a in list(self._allocations.items()):
                if a.expires_at_ms is not None and now >= a.expires_at_ms:
                    expired.append(tid)
                    self._allocations.pop(tid, None)
        return expired

    def get(self, target_id: str) -> MissionAllocation | None:
        with self._lock:
            return self._allocations.get(target_id)


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


class IoTMQTTConfig:
    def __init__(
        self,
        *,
        host: str,
        port: int = 1883,
        client_id: str,
        username: str | None = None,
        password: str | None = None,
        keepalive: int = 30,
        qos: int = 2,
    ) -> None:
        self.host = host
        self.port = port
        self.client_id = client_id
        self.username = username
        self.password = password
        self.keepalive = keepalive
        self.qos = qos


class IoTMQTTTransport:
    """Optional paho-mqtt adapter that delivers decoded :class:`IoTEnvelope` payloads."""

    def __init__(self, config: IoTMQTTConfig) -> None:
        if mqtt is None:
            raise RuntimeError("paho-mqtt is required for IoTMQTTTransport")
        self.config = config
        self._client = mqtt.Client(client_id=config.client_id)
        if config.username is not None:
            self._client.username_pw_set(config.username, config.password)
        self._connected = threading.Event()
        self._handlers: DefaultDict[str, list[Callable[[IoTEnvelope], None]]] = defaultdict(list)
        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect
        self._client.on_message = self._on_message

    def connect(self) -> None:
        self._client.connect(self.config.host, self.config.port, self.config.keepalive)
        self._client.loop_start()

    def disconnect(self) -> None:
        self._client.loop_stop()
        self._client.disconnect()

    def publish(self, topic: str, payload: str, qos: int | None = None, retain: bool = False) -> Any:
        q = self.config.qos if qos is None else qos
        return self._client.publish(topic, payload, qos=q, retain=retain)

    def subscribe(self, topic: str, qos: int | None = None) -> Any:
        q = self.config.qos if qos is None else qos
        return self._client.subscribe(topic, qos=q)

    def on(self, topic_filter: str, handler: Callable[[IoTEnvelope], None]) -> None:
        self._handlers[topic_filter].append(handler)
        self.subscribe(topic_filter)

    def _on_connect(self, _c: Any, _u: Any, _f: Any, rc: int) -> None:  # pragma: no cover
        if rc == 0:
            self._connected.set()
        else:
            LOG.warning("IoT MQTT connect rc=%s", rc)

    def _on_disconnect(self, _c: Any, _u: Any, _rc: int) -> None:  # pragma: no cover
        self._connected.clear()

    def _on_message(self, _c: Any, _u: Any, msg: Any) -> None:  # pragma: no cover
        try:
            raw = msg.payload.decode("utf-8") if isinstance(msg.payload, (bytes, bytearray)) else str(msg.payload)
            envelope = IoTEnvelope.from_json(raw)
        except Exception:
            LOG.exception("could not decode IoT message on %s", getattr(msg, "topic", "?"))
            return
        for topic_filter, handlers in self._handlers.items():
            if topic_matches(topic_filter, envelope.topic):
                for h in handlers:
                    try:
                        h(envelope)
                    except Exception:
                        LOG.exception("iot handler failed for %s", topic_filter)


class SwarmIoTActuation:
    """Factory helpers for edge actuator commands (lights, buzzer, gripper, payload)."""

    @staticmethod
    def light_on(target_id: str, requester_id: str) -> EdgeCommand:
        return EdgeCommand(
            command_id=f"cmd-{random.getrandbits(32):08x}",
            command=CommandType.LIGHT_ON,
            target_id=target_id,
            requester_id=requester_id,
        )

    @staticmethod
    def light_off(target_id: str, requester_id: str) -> EdgeCommand:
        return EdgeCommand(
            command_id=f"cmd-{random.getrandbits(32):08x}",
            command=CommandType.LIGHT_OFF,
            target_id=target_id,
            requester_id=requester_id,
        )

    @staticmethod
    def buzzer_on(target_id: str, requester_id: str) -> EdgeCommand:
        return EdgeCommand(
            command_id=f"cmd-{random.getrandbits(32):08x}",
            command=CommandType.BUZZER_ON,
            target_id=target_id,
            requester_id=requester_id,
        )

    @staticmethod
    def grip_close(target_id: str, requester_id: str) -> EdgeCommand:
        return EdgeCommand(
            command_id=f"cmd-{random.getrandbits(32):08x}",
            command=CommandType.GRIP_CLOSE,
            target_id=target_id,
            requester_id=requester_id,
        )


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
        self.telemetry_cache = (
            TelemetryCache(Path(persistence_dir) / f"{swarm_id}.{node_id}.telemetry.json") if persistence_dir else None
        )
        self.fusion = SensorFusionEngine()
        self.geofences = GeoFenceManager()
        self.safety = SafetyController(self.geofences)
        self.health = FleetHealthMonitor()
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
        safety_events = self.safety.inspect(telem)
        report = self.health.update(telem, safety_events)
        if self.telemetry_cache is not None:
            self.telemetry_cache.append(telem)
        topic = self.topics.telemetry(telem.device_id)
        body = telem.to_dict()
        body["health"] = report.to_dict()
        body["safety"] = [e.to_dict() for e in safety_events]
        body["fused"] = self.fusion.summary()
        env = self.build_envelope("telemetry", topic, body)
        return self.publish_envelope(env)

    def publish_sensor_reading(self, telem: DroneTelemetry, reading: SensorReading, *, fusion_key: str | None = None) -> str | Any:
        key = fusion_key or reading.sensor_type
        self.fusion.ingest(
            key,
            FusionSample(
                source_id=reading.source_id or telem.device_id,
                sensor_type=reading.sensor_type,
                value=reading.value,
                confidence=reading.confidence,
                location=reading.location,
                metadata=reading.metadata,
            ),
        )
        payload = reading.to_dict()
        payload["device_id"] = telem.device_id
        payload["mode"] = telem.mode.value
        env = self.build_envelope("sensor", self.topics.sensors(telem.device_id), payload)
        return self.publish_envelope(env)

    def ingest_geofence_payload(self, data: Mapping[str, Any]) -> GeoFence:
        pts = [Position3D.from_dict(p) for p in data.get("points", [])]
        fence = GeoFence(
            fence_id=str(data.get("fence_id", f"fence-{random.getrandbits(32):08x}")),
            name=str(data.get("name", "fence")),
            points=pts,
            min_alt_m=float(data.get("min_alt_m", 0.0)),
            max_alt_m=float(data.get("max_alt_m", 120.0)),
            enabled=bool(data.get("enabled", True)),
            emergency_exit=bool(data.get("emergency_exit", False)),
            metadata=dict(data.get("metadata", {})),
        )
        self.geofences.add(fence)
        return fence

    def _fused_sensor_value(self, sensor_type: str) -> FusionResult | None:
        if sensor_type in {"temperature", "altitude", "distance", "pressure"}:
            return self.fusion.fuse_numeric(sensor_type)
        if sensor_type in {"victim_detected", "obstacle", "hazard"}:
            return self.fusion.fuse_boolean(sensor_type)
        if sensor_type in {"location", "position", "gps"}:
            return self.fusion.fuse_location(sensor_type)
        return self.fusion.fuse_numeric(sensor_type) or self.fusion.fuse_boolean(sensor_type) or self.fusion.fuse_location(sensor_type)

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
            raw = dict(env.payload)
            raw.pop("health", None)
            raw.pop("safety", None)
            raw.pop("fused", None)
            telem = DroneTelemetry.from_dict(raw)
            self.registry.update_from_telemetry(telem)
            if self.telemetry_cache is not None:
                self.telemetry_cache.append(telem)
            safety_events = self.safety.inspect(telem)
            report = self.health.update(telem, safety_events)
            viol = self.geofences.check_violations(telem.position)
            return {
                "telemetry": True,
                "health": report.to_dict(),
                "geofence_violations": [f.fence_id for f in viol],
                "safety_events": [e.to_dict() for e in safety_events],
            }
        if env.kind == "sensor":
            reading = SensorReading.from_dict(env.payload)
            src = str(env.payload.get("device_id", env.device_id))
            self.fusion.ingest(
                reading.sensor_type,
                FusionSample(
                    source_id=src,
                    sensor_type=reading.sensor_type,
                    value=reading.value,
                    confidence=reading.confidence,
                    location=reading.location,
                    metadata=reading.metadata,
                ),
            )
            return {"fused": self.fusion.summary()}
        if env.kind == "geofence":
            self.ingest_geofence_payload(env.payload)
            return {"geofence": True}
        if env.kind == "command":
            cmd = EdgeCommand.from_dict(env.payload)
            if cmd.command is CommandType.REQUEST_HEALTH:
                entry = self.registry.get(cmd.target_id)
                ok = entry is not None
                res = EdgeCommandResult(
                    command_id=cmd.command_id,
                    ok=ok,
                    result={"registry": asdict(entry)} if entry else {},
                    error=None if ok else "unknown_device",
                )
                if cmd.expect_ack:
                    ack = self.build_envelope("command_result", self.topics.results(self.node_id), res.to_dict())
                    if self.signer is not None:
                        ack.signature = self.signer.sign(ack)
                    self.publish_envelope(ack, offline_ok=True)
                return {"command": cmd.command.value, "ok": ok}
            if cmd.command is CommandType.REQUEST_SENSOR:
                st = str(cmd.args.get("sensor_type", ""))
                fused = self._fused_sensor_value(st) if st else None
                res = EdgeCommandResult(
                    command_id=cmd.command_id,
                    ok=bool(st),
                    result={"sensor_type": st, "fused": fused.to_dict() if fused else None},
                    error=None if st else "sensor_type_required",
                )
                if cmd.expect_ack:
                    ack = self.build_envelope("command_result", self.topics.results(self.node_id), res.to_dict())
                    if self.signer is not None:
                        ack.signature = self.signer.sign(ack)
                    self.publish_envelope(ack, offline_ok=True)
                return {"command": cmd.command.value, "ok": res.ok}
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