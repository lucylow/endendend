# 5-Drone Swarm Backend Improvements

## Overview

This document describes the improvements made to the Webots simulation backend for a 5-drone search-and-rescue swarm with P2P coordination, bully election, and network partition handling.

## Architecture Changes

### 1. Per-Drone P2P Servers (p2p_server.py)

**Removed:** Central Flask/SocketIO broker (app.py)

**Added:** Per-drone Flask/SocketIO web servers on unique ports:
- `drone_0`: Port 9001 (Explorer)
- `drone_1`: Port 9002 (Relay 1)
- `drone_2`: Port 9003 (Relay 2)
- `drone_3`: Port 9004 (Standby 1)
- `drone_4`: Port 9005 (Standby 2)

**Features:**
- Each drone exposes its own WebSocket endpoint
- Decentralized message routing (no central aggregator)
- P2P message envelope with standardized format
- Broadcast and unicast message support

**Usage:**
```python
from swarm.p2p_server import P2PServer

server = P2PServer("drone_0", host="127.0.0.1", port=9001)
server.initialize()
server.start()

# Broadcast message to all peers
server.broadcast_message("HEARTBEAT", {"battery": 85.0, "depth": 50.0})

# Send to specific peer
server.send_to_peer("drone_1", "ROLE_ANNOUNCE", {"role": "explorer"})
```

### 2. Bully Election Algorithm (bully_election.py)

**Implements:** Decentralized explorer role election with deterministic tie-breaking

**Election Priority (highest to lowest):**
1. **Depth**: Higher depth = higher priority (closer to target)
2. **Battery**: Higher battery = higher priority
3. **Lexicographic ID**: Alphabetical order for deterministic tie-breaking

**Features:**
- Automatic re-election on explorer timeout
- Depth-based leader election (optimal for tunnel/cave scenarios)
- Election state machine (IDLE, ELECTION_IN_PROGRESS, ELECTED, FOLLOWER)
- Heartbeat timeout detection triggers re-election

**Usage:**
```python
from swarm.bully_election import BullyElection

election = BullyElection(
    node_id="drone_0",
    all_nodes=["drone_0", "drone_1", "drone_2", "drone_3", "drone_4"],
    depth=50.0,
    battery=100.0,
    on_elected=lambda: print("I'm the explorer!"),
    on_lost_election=lambda: print("I'm a relay/standby"),
)

election.start_election()
leader = election.tick()  # Returns elected leader ID
```

### 3. Enhanced ChainManager (chain_manager_enhanced.py)

**Improvements over original:**
- State update callbacks triggered on topology changes
- Relay chain rebuilt from local peer state only
- Dynamic relay insertion based on depth and connectivity
- Peer state tracking with signal quality metrics

**Features:**
- `state_update_callback`: Triggered on every topology change
- `on_role_change`: Triggered when drone role changes
- Relay chain management with depth-based ordering
- Peer liveness tracking with timeout handling

**Usage:**
```python
from swarm.chain_manager_enhanced import EnhancedChainManager, DroneRole

chain = EnhancedChainManager(
    node_id="drone_0",
    on_state_update=lambda state: print(f"Topology: {state}"),
    on_role_change=lambda role: print(f"New role: {role.value}"),
)

# Update peer state
chain.update_peer_state("drone_1", "relay", depth=40.0, battery=90.0)

# Set local role
chain.set_role(DroneRole.EXPLORER)

# Get relay chain
relay_chain = chain.get_relay_chain()
```

### 4. Network Partition Handler (partition_handler.py)

**Detects and handles:**
- Heartbeat timeout detection (5s default)
- Split-brain prevention via ROLE_ANNOUNCE conflict resolution
- Graceful degradation on node dropout
- Partition state tracking (HEALTHY, DEGRADED, PARTITIONED, RECOVERING)

**Features:**
- Automatic partition detection based on alive peer ratio
- Split-brain resolution with deterministic priority
- Peer liveness tracking with consecutive miss counter
- Partition recovery detection

**Partition States:**
- **HEALTHY**: ≥80% peers alive
- **DEGRADED**: 50-80% peers alive
- **PARTITIONED**: <50% peers alive
- **RECOVERING**: Transitioning from PARTITIONED to DEGRADED

**Usage:**
```python
from swarm.partition_handler import PartitionHandler

handler = PartitionHandler(
    node_id="drone_0",
    heartbeat_timeout_ms=5000,
    on_partition_detected=lambda reason: print(f"Partition: {reason}"),
    on_partition_recovered=lambda: print("Partition recovered"),
)

handler.set_expected_peers(["drone_0", "drone_1", "drone_2", "drone_3", "drone_4"])
handler.record_heartbeat("drone_1")

status = handler.tick()
if handler.is_partitioned():
    print("Network is partitioned!")
```

### 5. Network Emulation Configuration (network_emulation_config.py)

**Configures network impairments using tc (traffic control)**

**Predefined Scenarios:**
- **HEALTHY**: 0% loss, 1ms latency
- **DEGRADED**: 5% loss, 50ms latency, 10ms jitter
- **CONGESTED**: 10% loss, 100ms latency, 20ms jitter
- **BLACKOUT**: 100% loss, 1000ms latency (all links down)
- **PARTITION**: Split into two groups with inter-group blackout
- **RECOVERY**: 2% loss, 20ms latency, 5ms jitter

**Depth-Based Link Quality:**
- Loss increases with depth separation
- Latency models signal travel through rock/water
- Jitter increases with poor signal

**Usage:**
```python
from swarm.network_emulation_config import (
    BlackoutEnvironmentSimulator,
    NetworkScenario,
    calculate_link_quality,
)

# Create simulator
simulator = BlackoutEnvironmentSimulator([9001, 9002, 9003, 9004, 9005])

# Apply scenario
simulator.apply_scenario(NetworkScenario.BLACKOUT)

# Calculate depth-based link quality
impairment = calculate_link_quality(source_depth=50.0, dest_depth=10.0)
print(f"Loss: {impairment.loss_percent}%, Latency: {impairment.latency_ms}ms")

# Cleanup
simulator.cleanup()
```

### 6. Webots World File (worlds/five_drone_swarm.wbt)

**5-Drone Configuration:**
- **drone_0** (z=50): Explorer (deepest)
- **drone_1** (z=40): Relay 1
- **drone_2** (z=30): Relay 2
- **drone_3** (z=20): Standby 1
- **drone_4** (z=10): Standby 2 (shallowest)

**Environment:**
- Collapsed building structure
- Rubble piles
- Tunnel entrance
- Hazard zones
- Target markers

**Depth-based positioning enables:**
- Natural relay chain formation
- Realistic signal degradation
- Depth-based election priority

### 7. Integrated 5-Drone Launcher (scripts/run_5drone_p2p.py)

**Orchestrates:**
1. Per-drone P2P server initialization
2. Bully election startup
3. Network emulation configuration
4. Coordinator tick loop with heartbeat broadcasting

**Features:**
- Automatic election result logging
- Partition detection and recovery tracking
- Network scenario application
- Configurable simulation duration

**Usage:**
```bash
# Run with healthy network
python scripts/run_5drone_p2p.py --scenario healthy --duration-s 60

# Run with blackout scenario
python scripts/run_5drone_p2p.py --scenario blackout --duration-s 60

# Run with partition scenario
python scripts/run_5drone_p2p.py --scenario partition --duration-s 60
```

## P2P Message Types

### HEARTBEAT
Periodic liveness signal with role and state information.

```json
{
  "sender_id": "drone_0",
  "message_kind": "HEARTBEAT",
  "timestamp_ms": 1234567890,
  "payload": {
    "role": "explorer",
    "depth": 50.0,
    "battery": 85.0,
    "leader": "drone_0",
    "election_state": "elected"
  }
}
```

### ROLE_ANNOUNCE
Role change announcement for split-brain prevention.

```json
{
  "sender_id": "drone_0",
  "message_kind": "ROLE_ANNOUNCE",
  "timestamp_ms": 1234567890,
  "payload": {
    "role": "explorer",
    "depth": 50.0,
    "battery": 85.0
  }
}
```

### ELECTION_WIN
Leader election result announcement.

```json
{
  "sender_id": "drone_0",
  "message_kind": "ELECTION_WIN",
  "timestamp_ms": 1234567890,
  "payload": {
    "leader": "drone_0",
    "depth": 50.0,
    "battery": 100.0
  }
}
```

### KILL
Emergency stop signal (safety-critical).

```json
{
  "sender_id": "drone_0",
  "message_kind": "KILL",
  "timestamp_ms": 1234567890,
  "payload": {
    "reason": "safety_violation"
  }
}
```

## Integration with Existing Code

The improvements maintain compatibility with existing modules:

- **DroneController**: Unchanged; receives P2P messages via message handlers
- **ExplorationManager**: Receives EXPLORATION_UPDATE messages as before
- **TargetManager**: Unchanged; works with relay chain topology
- **NetworkSimulator**: Continues to provide link statistics and scenario events

## Testing

Run the integrated coordinator:

```bash
# Terminal 1: Start coordinator
python scripts/run_5drone_p2p.py --scenario healthy --duration-s 120

# Terminal 2: Monitor election results
tail -f logs/swarm.log | grep -i election

# Terminal 3: Monitor partitions
tail -f logs/swarm.log | grep -i partition
```

## Performance Considerations

- **Election Timeout**: 5 seconds (configurable)
- **Heartbeat Timeout**: 10 seconds (configurable)
- **Partition Detection**: Real-time based on alive peer ratio
- **Message Overhead**: ~500 bytes per heartbeat (10 drones, 10Hz = ~50 KB/s)

## Future Enhancements

1. **Byzantine Fault Tolerance**: Extend election to handle malicious nodes
2. **Consensus Protocols**: Add PBFT for critical decisions
3. **Adaptive Timeouts**: Adjust timeouts based on network conditions
4. **Multi-Hop Relay**: Support longer chains with intermediate relays
5. **Mesh Routing**: Implement full mesh with distance-vector routing
