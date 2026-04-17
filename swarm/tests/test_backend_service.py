"""Tests for ``swarm.backend_service`` (no live broker: uses :class:`MockFoxMQClient`)."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from swarm.backend_service import (
    BackendSettings,
    CommandResponse,
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
    mesh_tashi_projection,
    public_command_result,
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


class TestTashiProjection(unittest.TestCase):
    def test_mesh_tashi_projection_keys(self) -> None:
        node = {
            "node_id": "n1",
            "swarm_id": "s1",
            "version": 7,
            "updated_at_ms": 123,
            "role": "command",
            "status": "ready",
            "depth": 2,
            "peers": {"a": {}, "b": {}},
            "tasks": {"t1": {}},
            "alerts": [],
            "registers": {"world_map": {"value": {"cells": {}}, "version": 3}},
            "metrics": {"x": 1},
        }
        proj = mesh_tashi_projection(node, missions_brief=[{"mission_id": "m1", "name": "x", "status": "draft"}])
        self.assertEqual(proj["mesh"]["version"], 7)
        self.assertEqual(proj["mesh"]["peerCount"], 2)
        self.assertEqual(proj["registers"]["keys"], ["world_map"])
        self.assertEqual(proj["chainHint"]["monotonicMeshVersion"], 7)
        self.assertEqual(len(proj["missionsBrief"]), 1)

    def test_public_command_result_async_and_sync(self) -> None:
        async_body = public_command_result(None)
        self.assertTrue(async_body["async"])
        self.assertTrue(async_body["ok"])
        self.assertIsNone(async_body["response"])
        sync = public_command_result(CommandResponse(True, message="ok", data={"node_id": "n1"}))
        self.assertFalse(sync["async"])
        self.assertTrue(sync["ok"])
        self.assertEqual(sync["result"]["node_id"], "n1")
        self.assertIn("response", sync)


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
                snap = cache.snapshot()
                self.assertIn("tashi", snap)
                self.assertEqual(snap["tashi"]["mesh"]["nodeId"], "n1")
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
