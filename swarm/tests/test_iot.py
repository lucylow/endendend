"""Tests for ``swarm.iot`` (no broker)."""

from __future__ import annotations

import threading
import unittest
from dataclasses import asdict

from swarm.iot import (
    BatteryState,
    CommandType,
    DroneTelemetry,
    EdgeCommand,
    EdgeCommandResult,
    FlightMode,
    FusionSample,
    GeoFence,
    IoTEnvelope,
    IoTEnvelopeGuard,
    IoTSigner,
    IoTTopicBuilder,
    MissionAllocation,
    MissionAllocator,
    Position3D,
    SensorFusionEngine,
    SwarmIoTBridge,
    Velocity3D,
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


class TestFusionAndAllocator(unittest.TestCase):
    def test_fuse_numeric_and_allocator_expire(self) -> None:
        from swarm.iot import DeviceRegistry, RegistryEntry

        reg = DeviceRegistry(None)
        reg.upsert(
            RegistryEntry(
                device_id="d1",
                battery_pct=80.0,
                capabilities=["camera"],
                online=True,
            )
        )
        alloc = MissionAllocator(reg)
        a = alloc.allocate("m1", "t1", {"capabilities": ["camera"], "ttl_s": 0})
        self.assertIsNotNone(a)
        assert a is not None
        self.assertEqual(a.assigned_device, "d1")
        expired = alloc.expire()
        self.assertIn("t1", expired)

        fusion = SensorFusionEngine()
        fusion.ingest("temp", FusionSample(source_id="d1", sensor_type="temp", value=20.0, confidence=1.0))
        fusion.ingest("temp", FusionSample(source_id="d2", sensor_type="temp", value=30.0, confidence=1.0))
        out = fusion.fuse_numeric("temp")
        self.assertIsNotNone(out)
        assert out is not None
        self.assertAlmostEqual(float(out.fused_value), 25.0, places=5)


class TestTelemetryIncoming(unittest.TestCase):
    def test_strips_nested_health_before_parse(self) -> None:
        class _C:
            def __init__(self) -> None:
                self._connected = threading.Event()
                self._connected.set()

            def publish(self, *a: object, **k: object) -> str:
                return "ok"

            def subscribe(self, *a: object, **k: object) -> None:
                return None

        class _S:
            role = "r"

        bridge = SwarmIoTBridge(swarm_id="s", node_id="n1", state_store=_S(), client=_C())
        secret = b"\x05" * 32
        bridge.signer = IoTSigner(secret)
        bridge.guard = IoTEnvelopeGuard(bridge.signer)
        telem = DroneTelemetry(
            device_id="peer",
            position=Position3D(1, 2, 3),
            velocity=Velocity3D(0, 0, 0),
            battery=BatteryState(pct=90.0),
            mode=FlightMode.SEARCH,
        )
        body = telem.to_dict()
        body["health"] = {"device_id": "peer", "status": "x"}
        body["safety"] = []
        body["fused"] = {}
        env = IoTEnvelope(
            message_id="t1",
            device_id="peer",
            topic="swarm/s/iot/device/peer/telemetry",
            kind="telemetry",
            payload=body,
            ts_ms=current_time_ms(),
            signature=None,
        )
        env.signature = bridge.signer.sign(env)
        out = bridge.handle_incoming(env.to_json())
        self.assertIsNotNone(out)
        assert out is not None
        self.assertTrue(out.get("telemetry"))


class TestGeofenceEmergencyExit(unittest.TestCase):
    def test_emergency_exit_skips_violation(self) -> None:
        from swarm.iot import GeoFenceManager

        gm = GeoFenceManager()
        fence = GeoFence(
            fence_id="f1",
            name="n",
            points=[Position3D(0, 0, 0), Position3D(10, 0, 0), Position3D(10, 10, 0), Position3D(0, 10, 0)],
            emergency_exit=True,
        )
        gm.add(fence)
        outside = Position3D(50, 50, 5)
        self.assertEqual(len(gm.check_violations(outside)), 0)


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
