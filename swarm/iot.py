"""Lightweight IoT helpers for swarm demos (MQTT-style topics, signed envelopes)."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any, Mapping


def current_time_ms() -> int:
    return int(time.time() * 1000)


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

    def to_dict(self) -> dict[str, Any]:
        return {"command_id": self.command_id, "ok": self.ok, "result": self.result}


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

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "message_id": self.message_id,
            "device_id": self.device_id,
            "topic": self.topic,
            "kind": self.kind,
            "payload": self.payload,
            "ts_ms": self.ts_ms,
            "signature": self.signature,
        }
        if self.sequence is not None:
            d["sequence"] = self.sequence
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
        )


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
    def __init__(self, signer: IoTSigner) -> None:
        self._signer = signer

    def verify(self, env: IoTEnvelope) -> bool:
        return self._signer.verify(env, env.signature)


class SwarmIoTBridge:
    def __init__(self, swarm_id: str, node_id: str, state_store: Any, client: Any) -> None:
        self.swarm_id = swarm_id
        self.node_id = node_id
        self.state_store = state_store
        self.client = client
        self.signer: IoTSigner | None = None
        self.guard: IoTEnvelopeGuard | None = None

    def handle_incoming(self, raw: str) -> dict[str, Any] | None:
        env = IoTEnvelope.from_dict(json.loads(raw))
        if self.guard is None or not self.guard.verify(env):
            return None
        if env.kind == "command_result":
            return {"command_result": "accepted"}
        return None


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
    bridge = SwarmIoTBridge(
        swarm_id="s",
        node_id="n1",
        state_store=type("_S", (), {"role": "r"})(),
        client=mem,
    )
    bridge.signer = IoTSigner(b"\x01" * 32)
    topic = "swarm/s/iot/device/n1/telemetry"
    for i in range(3):
        env = IoTEnvelope(
            message_id=f"m{i}",
            device_id="n1",
            topic=topic,
            kind="telemetry",
            payload={"v": i},
            ts_ms=current_time_ms(),
            sequence=i,
            signature=None,
        )
        env.signature = bridge.signer.sign(env)
        mem.publish(topic, env.to_json())
    return {"published_count": mem.published_count}
