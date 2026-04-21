"""Multi-broker FoxMQ view: clients rotate hosts; mock mode shares one in-memory bus."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Dict, List, Optional

from swarm.foxmq_integration import (
    FoxMQClient,
    FoxMQConfig,
    MockFoxMQClient,
    StatePersistence,
    SwarmStateStore,
)


def _parse_hosts() -> List[str]:
    raw = os.environ.get("FOXMQ_BROKERS", "127.0.0.1")
    return [h.strip() for h in raw.split(",") if h.strip()]


class FoxMQCluster:
    """Logical cluster over one or more MQTT brokers (no ROS master).

    ``FOXMQ_BROKERS`` lists comma-separated hosts. When ``use_mock`` is True,
    :class:`MockFoxMQClient` instances share the process-local mesh envelope
    path (suitable for CI and single-machine demos).
    """

    def __init__(
        self,
        swarm_id: str,
        *,
        broker_hosts: Optional[List[str]] = None,
        broker_port: int = 19793,
        use_mock: Optional[bool] = None,
        persistence_root: Optional[Path] = None,
    ) -> None:
        self.swarm_id = swarm_id
        self.broker_hosts = list(broker_hosts or _parse_hosts())
        self.broker_port = int(broker_port)
        if use_mock is None:
            use_mock = os.environ.get("VERTEX_FOXMQ_MOCK", "1") == "1"
        self.use_mock = bool(use_mock)
        self._root = Path(persistence_root or Path(tempfile.gettempdir()) / "vertex_swarm_foxmq")
        self._root.mkdir(parents=True, exist_ok=True)
        self._stores: Dict[str, SwarmStateStore] = {}

    def join_cluster(self) -> None:
        """Idempotent hook for future cluster auth / mesh join."""
        return

    def client_for(self, node_id: str) -> FoxMQClient:
        path = self._root / f"{self.swarm_id}.{node_id}.json"
        persistence = StatePersistence(path)
        store = SwarmStateStore(node_id, self.swarm_id, persistence)
        self._stores[node_id] = store
        cfg = FoxMQConfig(
            swarm_id=self.swarm_id,
            node_id=node_id,
            broker_hosts=list(self.broker_hosts),
            broker_port=self.broker_port,
            persistence_dir=self._root / node_id,
        )
        if self.use_mock:
            c = MockFoxMQClient(cfg, store)
        else:
            c = FoxMQClient(cfg, store)
        c.connect()
        return c
