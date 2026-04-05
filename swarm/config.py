"""Swarm and grid configuration for decentralized exploration."""

from __future__ import annotations

from typing import List, Optional, Tuple

# --- Grid (2D field or tunnel with width) ---
GRID_CELL_SIZE = 5.0  # meters
GRID_WIDTH = 100  # cells in X
GRID_HEIGHT = 100  # cells in Y
# xmin, xmax, ymin, ymax (meters)
WORLD_BOUNDS = (0.0, 500.0, 0.0, 500.0)

# --- Motion ---
DRONE_MAX_SPEED = 8.0  # m/s (tune for Webots physics)

# --- Battery (Blind Handoff — aerial low-energy task transfer) ---
AERIAL_BATTERY_CAPACITY = 100.0  # percent
AERIAL_BATTERY_DRAIN_RATE = 0.2  # percent per second while active
GROUND_BATTERY_DRAIN_RATE = 0.05  # percent per second (slower)
BATTERY_HANDOFF_THRESHOLD = 20.0  # aerial requests ground takeover below this
HANDOFF_BID_WINDOW_SEC = 10.0  # collect HANDOFF_BID messages
GROUND_BATTERY_PER_METER = 0.5  # bid feasibility: estimated % cost per meter to victim
GROUND_BATTERY_RESERVE = 10.0  # minimum % left after travel estimate

# --- Target / rescue (mock detection + decentralized assignment) ---
TARGET_CONFIDENCE_THRESHOLD = 0.7
TARGET_CLEANUP_TIMEOUT = 300  # seconds; TTL for resolved entries if kept locally
TARGET_ASSIGN_TIMEOUT_SEC = 45.0  # reclaim if assigned but not resolved
VICTIM_DETECTION_DISTANCE = 12.0  # meters (GPS proximity to Solid / mock victim)
RESCUE_ARRIVAL_DISTANCE = 1.0  # meters; mark resolved inside this radius
# Default mock victim positions (x, y, z) in world meters — override in controller / Webots bridge
DEFAULT_VICTIM_POSITIONS: List[Tuple[float, float, float]] = [
    (75.0, 75.0, 0.0),
    (180.0, 120.0, 0.0),
    (320.0, 90.0, 0.0),
]

# --- FoxMQ / reference parity (optional broker use) ---
FOXMQ_HOST = "localhost"
FOXMQ_PORT = 7000
FOXMQ_CLUSTER_NAME = "swarm"
FOXMQ_REPLICATION_FACTOR = 3
FOXMQ_AUTH_TOKEN = ""

# --- Edge-local latency (Vertex / emulator) ---
# Optional MessagePack on the wire (requires ``pip install msgpack``).
USE_MSGPACK = False
# Scale simulated per-hop delay for priority=high (safety) traffic (1.0 = full model latency).
URGENT_LINK_LATENCY_SCALE = 0.35
# Process app messages on background threads (high-priority queue first). Default off for deterministic tests.
ASYNC_PRIORITY_QUEUES = False

# --- Scalability (Vertex / gossip / committee BFT) ---
# Peer-discovery gossip: each interval, unicast a bounded peer digest to this many random peers.
GOSSIP_FANOUT = 3
GOSSIP_PEER_LIST_CAP = 20
GOSSIP_INTERVAL_SEC = 2.0
# Heartbeats: when swarm size >= SCALABLE_PEER_COUNT_THRESHOLD, unicast to this many random peers
# per tick instead of full broadcast (0 = always broadcast).
HEARTBEAT_FANOUT = 3
HEARTBEAT_BASE_INTERVAL_SEC = 2.0
# When peer count is below this, use full broadcast for exploration (keeps small test swarms deterministic).
SCALABLE_PEER_COUNT_THRESHOLD = 16
# Above threshold: sample fan-out + epidemic relay for EXPLORATION_UPDATE.
SCALABLE_EXPLORATION_ENABLED = True
EXPLORATION_GOSSIP_FANOUT = 3
EXPLORATION_RELAY_TTL = 5
# Distance-vector: scale routing period with log(neighbors); cap for stability.
ROUTING_ADAPTIVE_ENABLED = True
ROUTING_PERIOD_BASE_SEC = 5.0
ROUTING_MAX_ADVERTISE_DESTS = 64
# PBFT: None = all replicas; int = first k sorted node ids form the committee (deterministic).
PBFT_COMMITTEE_SIZE: Optional[int] = None
# Target claiming: rendezvous hash over registered swarm ids (no bid storm). Off by default for unit tests.
TARGET_USE_RENDEZVOUS_CLAIM = False
