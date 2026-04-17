"""Tests for ``swarm.backend_service`` (no live broker: uses :class:`MockFoxMQClient`)."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from swarm.backend_service import (
    BackendSettings,
    FleetBroadcastHub,
    FleetViewCache,
    JSONFileStore,
    MeshPresenceTracker,
    MissionRepository,
    RemoteCommand,
    SwarmBackendRuntime,
    SwarmBackendService,
    SwarmCommandRouter,
    SwarmEventLedger,
    _mission_from_payload,
)
from swarm.foxmq_integration import (
    FoxMQBridge,
    FoxMQConfig,
    FoxMQMeshAdapter,
    MockFoxMQClient,
    StatePersistence,
    SwarmStateStore,
)


def _test_runtime(tmp: Path) -> SwarmBackendRuntime:
    cfg = FoxMQConfig(swarm_id="s", node_id="n1", broker_hosts=["127.0.0.1"], persistence_dir=tmp / "fox")
    cfg.validate()
    persistence = StatePersistence(cfg.local_state_path)
    store = SwarmStateStore("n1", "s", persistence)
    client = MockFoxMQClient(cfg, store)
    client.connect()
    adapter = FoxMQMeshAdapter(client, store)
    bridge = FoxMQBridge(adapter)
    presence = MeshPresenceTracker(store, stale_peer_s=1, dead_peer_s=30)
    router = SwarmCommandRouter(bridge)
    return SwarmBackendRuntime(bridge=bridge, presence=presence, router=router)


class TestMissionRepository(unittest.TestCase):
    def test_ignores_unknown_keys_on_load(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "m.json"
            p.write_text(
                json.dumps(
                    {
                        "missions": {
                            "m1": {
                                "mission_id": "m1",
                                "name": "x",
                                "future_field": 123,
                            }
                        }
                    }
                ),
                encoding="utf-8",
            )
            repo = MissionRepository(JSONFileStore(p))
            m = repo.get("m1")
            self.assertIsNotNone(m)
            assert m is not None
            self.assertEqual(m.name, "x")

    def test_mission_from_payload_filters_keys(self) -> None:
        m = _mission_from_payload({"mission_id": "a", "name": "n", "extra": 1})
        self.assertEqual(m.mission_id, "a")
        self.assertFalse(hasattr(m, "extra"))


class TestLedgerTail(unittest.TestCase):
    def test_tail_reads_last_lines(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "e.jsonl"
            ledger = SwarmEventLedger(path)
            for i in range(50):
                ledger.append("evt", {"i": i})
            tail = ledger.tail(5)
            self.assertEqual(len(tail), 5)
            self.assertEqual(tail[-1]["payload"]["i"], 49)


class TestBackendServiceCore(unittest.TestCase):
    def test_local_remote_command_health(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            t = Path(tmp)
            runtime = _test_runtime(t)
            runtime.bridge.start()
            try:
                settings = BackendSettings(
                    data_dir=t / "backend",
                    mission_state_path=t / "backend" / "mission_state.json",
                    event_log_path=t / "backend" / "events.jsonl",
                    metric_snapshot_path=t / "backend" / "metrics.json",
                )
                svc = SwarmBackendService(runtime, settings)
                resp = svc.send_remote_command("n1", RemoteCommand.GET_HEALTH, {}, wait=True)
                self.assertIsNotNone(resp)
                assert resp is not None
                self.assertTrue(resp.ok)
                self.assertIn("node_id", resp.data)
            finally:
                runtime.bridge.stop()

    def test_publish_state_uses_mesh_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            t = Path(tmp)
            runtime = _test_runtime(t)
            runtime.bridge.start()
            try:
                store = runtime.bridge.adapter.state_store
                presence = MeshPresenceTracker(store, stale_peer_s=5, dead_peer_s=10)
                repo = MissionRepository(JSONFileStore(t / "m.json"))
                cache = FleetViewCache(store, presence, repo, capacity=8)
                hub = FleetBroadcastHub(runtime.bridge.adapter.client, cache)
                hub.publish_state()
                client = runtime.bridge.adapter.client
                assert isinstance(client, MockFoxMQClient)
                state_publishes = [x for x in client.sent if "mesh/state" in x[0] and "mesh/state/request" not in x[0]]
                self.assertTrue(state_publishes)
                inner = json.loads(state_publishes[-1][1])
                self.assertEqual(inner["payload"]["node_id"], "n1")
            finally:
                runtime.bridge.stop()


if __name__ == "__main__":
    unittest.main()
