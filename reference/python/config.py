# FoxMQ configuration — use with a real FoxMQ / Tashi broker on your drones.

FOXMQ_HOST = "localhost"
FOXMQ_PORT = 7000
FOXMQ_CLUSTER_NAME = "swarm"
FOXMQ_REPLICATION_FACTOR = 3
# Optional: require this token on put/CAS (configure broker accordingly).
FOXMQ_AUTH_TOKEN = ""

# Robustness (mirror TypeScript demo / physical drones)
ACTIVE_TIMEOUT_SEC = 5.0
STALE_PEER_TOTAL_TIMEOUT_SEC = 30.0
RELAY_INSERTION_DISTANCE_STEP = 8.0
STATE_SNAPSHOT_INTERVAL_SEC = 30.0
RELIABLE_MAX_RETRIES = 3
RELIABLE_ACK_TIMEOUT_SEC = 1.0
SOLO_SEEK_DISCOVER_INTERVAL_SEC = 3.0
