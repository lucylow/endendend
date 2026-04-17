"""Unit tests for ``swarm.foxmq_integration`` (no live MQTT broker)."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from swarm.foxmq_integration import (
    DedupeCache,
    EnvelopeSigner,
    FoxMQConfig,
    MeshEnvelope,
    MessageKind,
    MockFoxMQClient,
    StatePersistence,
    SwarmStateStore,
    TaskAuctioneer,
    topic_matches,
    swarm_topic,
)


class TestTopicHelpers(unittest.TestCase):
    def test_swarm_topic(self) -> None:
        self.assertEqual(swarm_topic("s1", "mesh/ping"), "swarm/s1/mesh/ping")

    def test_topic_matches(self) -> None:
        self.assertTrue(topic_matches("swarm/s1/#", "swarm/s1/mesh/state"))
        self.assertTrue(topic_matches("a/+/c", "a/b/c"))
        self.assertFalse(topic_matches("a/+/c", "a/b/d"))


class TestDedupeAndStore(unittest.TestCase):
    def test_dedupe(self) -> None:
        d = DedupeCache(ttl_s=60.0, max_items=8)
        self.assertFalse(d.seen("a"))
        self.assertTrue(d.seen("a"))

    def test_state_store_task_merge(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "s.json"
            persistence = StatePersistence(p)
            store = SwarmStateStore("n1", "sw1", persistence)
            store.upsert_task("t1", {"x": 1})
            self.assertEqual(store.get_task_payload("t1"), {"x": 1})


class TestEnvelopeSigning(unittest.TestCase):
    def test_sign_verify_roundtrip(self) -> None:
        secret = b"\x01" * 32
        signer = EnvelopeSigner(secret)
        env = MeshEnvelope(
            kind=MessageKind.HELLO,
            swarm_id="s",
            sender_id="n1",
            topic="swarm/s/mesh/hello",
            message_id="m1",
            timestamp_ms=1,
            seq=1,
            payload={"a": 1},
        )
        env.signature = signer.sign_payload(env)
        self.assertTrue(signer.verify_payload(env, env.signature))
        env2 = MeshEnvelope(
            kind=MessageKind.HELLO,
            swarm_id="s",
            sender_id="n1",
            topic="swarm/s/mesh/hello",
            message_id="m1",
            timestamp_ms=1,
            seq=1,
            payload={"a": 2},
            signature=env.signature,
        )
        self.assertFalse(signer.verify_payload(env2, env.signature))


class TestMockClientAndAuction(unittest.TestCase):
    def test_mock_publish_ids_monotonic(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cfg = FoxMQConfig(swarm_id="s", node_id="a", broker_hosts=["127.0.0.1"], persistence_dir=Path(tmp))
            cfg.validate()
            persistence = StatePersistence(cfg.local_state_path)
            store = SwarmStateStore("a", "s", persistence)
            client = MockFoxMQClient(cfg, store)
            client.connect()
            m1 = client.publish(MessageKind.HELLO, "mesh/hello", {"k": 1})
            m2 = client.publish(MessageKind.HELLO, "mesh/hello", {"k": 2})
            self.assertNotEqual(m1, m2)
            self.assertTrue(len(client.sent) >= 2)

    def test_auctioneer_commit(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cfg = FoxMQConfig(swarm_id="s", node_id="a", broker_hosts=["127.0.0.1"], persistence_dir=Path(tmp))
            persistence = StatePersistence(cfg.local_state_path)
            store = SwarmStateStore("a", "s", persistence)
            client = MockFoxMQClient(cfg, store)
            client.connect()
            auction = TaskAuctioneer(client, store)
            auction.propose_task("t1", "search", {"q": 1})
            store.update_register(
                "task_bids:t1",
                [{"bidder_id": "b", "bid": {"score": 0.5, "eta_ms": 100}}],
                source_id="b",
            )
            winner = auction.maybe_commit("t1")
            self.assertEqual(winner, "b")


if __name__ == "__main__":
    unittest.main()
