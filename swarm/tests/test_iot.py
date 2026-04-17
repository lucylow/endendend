"""Tests for ``swarm.iot`` (no broker)."""

from __future__ import annotations

import threading
import unittest
from dataclasses import asdict

from swarm.iot import (
    EdgeCommandResult,
    IoTEnvelope,
    IoTEnvelopeGuard,
    IoTSigner,
    IoTTopicBuilder,
    MissionAllocation,
    SwarmIoTBridge,
    current_time_ms,
    iot_smoke_demo,
    topic_matches,
)


class TestTopicMatches(unittest.TestCase):
    def test_wildcards(self) -> None:
        self.assertTrue(topic_matches("swarm/s1/iot/device/+/telemetry", "swarm/s1/iot/device/d1/telemetry"))
        self.assertFalse(topic_matches("swarm/s1/iot/device/+/telemetry", "swarm/s1/iot/device/d1/sensor"))
        self.assertTrue(topic_matches("a/#", "a/b/c"))


class TestSignerAndEnvelope(unittest.TestCase):
    def test_sign_verify_excludes_signature_field(self) -> None:
        secret = b"\x02" * 32
        signer = IoTSigner(secret)
        env = IoTEnvelope(
            message_id="m1",
            device_id="d1",
            topic="t",
            kind="k",
            payload={"a": 1},
            ts_ms=1,
            sequence=1,
            signature=None,
        )
        env.signature = signer.sign(env)
        self.assertTrue(signer.verify(env, env.signature))
        env.payload = {"a": 2}
        self.assertFalse(signer.verify(env, env.signature))


class TestMissionAllocationSerialization(unittest.TestCase):
    def test_asdict_works_for_slots_dataclass(self) -> None:
        a = MissionAllocation(mission_id="m", target_id="t", assigned_device="d", score=1.0, reason="ok")
        self.assertFalse(hasattr(a, "__dict__"))
        self.assertEqual(asdict(a)["mission_id"], "m")


class TestIoTTopicBuilder(unittest.TestCase):
    def test_device_telemetry_paths(self) -> None:
        b = IoTTopicBuilder("alpha")
        self.assertEqual(b.telemetry("d1"), "swarm/alpha/iot/device/d1/telemetry")
        self.assertTrue(topic_matches(f"{b.base()}/device/+/telemetry", b.telemetry("d1")))


class TestEnvelopeGuardDedup(unittest.TestCase):
    def test_replay_rejected_when_dedup_enabled(self) -> None:
        signer = IoTSigner(b"\x03" * 32)
        guard = IoTEnvelopeGuard(signer, dedup_max=100)
        env = IoTEnvelope(
            message_id="once",
            device_id="d",
            topic="t",
            kind="k",
            payload={},
            ts_ms=current_time_ms(),
            signature=None,
        )
        env.signature = signer.sign(env)
        self.assertTrue(guard.verify(env))
        self.assertFalse(guard.verify(env))


class TestSmokeDemo(unittest.TestCase):
    def test_iot_smoke_demo_runs(self) -> None:
        out = iot_smoke_demo()
        self.assertIn("published_count", out)
        self.assertGreater(out["published_count"], 0)


class TestIncomingCommandResult(unittest.TestCase):
    def test_handle_command_result_payload(self) -> None:
        class _C:
            def __init__(self) -> None:
                self._connected = threading.Event()
                self._connected.set()

            def publish(self, *args: object, **kwargs: object) -> str:
                return "ok"

            def subscribe(self, *args: object, **kwargs: object) -> None:
                return None

        class _S:
            role = "r"

        bridge = SwarmIoTBridge(swarm_id="s", node_id="n1", state_store=_S(), client=_C())
        secret = b"\x00" * 32
        bridge.signer = IoTSigner(secret)
        bridge.guard = IoTEnvelopeGuard(bridge.signer)
        env = IoTEnvelope(
            message_id="cr1",
            device_id="n1",
            topic="t",
            kind="command_result",
            payload=EdgeCommandResult(command_id="c1", ok=True, result={"x": 1}).to_dict(),
            ts_ms=current_time_ms(),
            signature=None,
        )
        env.signature = bridge.signer.sign(env)
        out = bridge.handle_incoming(env.to_json())
        self.assertIsNotNone(out)
        assert out is not None
        self.assertIn("command_result", out)


if __name__ == "__main__":
    unittest.main()
