# Installation and Usage Guide

## Quick Start

### Prerequisites

- Python 3.8+
- Flask and Flask-SocketIO
- Webots (optional, for visualization)

### Installation

```bash
# Install dependencies
pip install flask flask-socketio python-socketio python-engineio

# Verify installation
python -c "from swarm.p2p_server import P2PServer; print('P2P server imported successfully')"
```

### Running the 5-Drone Coordinator

```bash
# Run with healthy network scenario
python scripts/run_5drone_p2p.py --scenario healthy --duration-s 120

# Run with degraded network
python scripts/run_5drone_p2p.py --scenario degraded --duration-s 120

# Run with blackout scenario
python scripts/run_5drone_p2p.py --scenario blackout --duration-s 120

# Run with partition scenario
python scripts/run_5drone_p2p.py --scenario partition --duration-s 120
```

### Running with Webots

```bash
# Launch Webots with the 5-drone world
webots worlds/five_drone_swarm.wbt

# Or run headless
webots --batch worlds/five_drone_swarm.wbt --mode=run
```

## Module Overview

### Core Modules

1. **p2p_server.py**: Per-drone WebSocket server
   - Manages P2P connections
   - Handles message routing
   - Tracks connected peers

2. **bully_election.py**: Decentralized leader election
   - Depth-based priority
   - Automatic re-election on timeout
   - Deterministic tie-breaking

3. **chain_manager_enhanced.py**: Topology and relay management
   - Tracks peer states
   - Maintains relay chains
   - Triggers state callbacks

4. **partition_handler.py**: Network partition detection
   - Monitors heartbeat timeouts
   - Detects split-brain conditions
   - Tracks partition state

5. **network_emulation_config.py**: Network impairment simulation
   - Configures tc rules
   - Applies predefined scenarios
   - Models depth-based link quality

### Supporting Files

- **worlds/five_drone_swarm.wbt**: Webots world with 5 Mavic drones
- **scripts/run_5drone_p2p.py**: Integrated coordinator launcher
- **BACKEND_IMPROVEMENTS.md**: Detailed architecture documentation

## Configuration

### Drone Ports

Default port assignments:
- drone_0: 9001 (Explorer, depth=50m)
- drone_1: 9002 (Relay 1, depth=40m)
- drone_2: 9003 (Relay 2, depth=30m)
- drone_3: 9004 (Standby 1, depth=20m)
- drone_4: 9005 (Standby 2, depth=10m)

### Timeouts

Edit `scripts/run_5drone_p2p.py` to adjust:
- `election_timeout_s`: Time to complete election (default: 5s)
- `heartbeat_timeout_ms`: Heartbeat timeout (default: 5000ms)
- `stale_timeout_ms`: Stale peer timeout (default: 10000ms)
- `dead_timeout_ms`: Dead peer timeout (default: 30000ms)

### Network Scenarios

Available scenarios in `network_emulation_config.py`:
- `HEALTHY`: 0% loss, 1ms latency
- `DEGRADED`: 5% loss, 50ms latency
- `CONGESTED`: 10% loss, 100ms latency
- `BLACKOUT`: 100% loss (all links down)
- `PARTITION`: Split into two groups
- `RECOVERY`: 2% loss, 20ms latency

## Monitoring and Debugging

### Log Output

The coordinator logs all major events:

```
[2026-04-21 16:00:00] swarm.p2p_server - INFO - [drone_0] P2P server started on 127.0.0.1:9001
[2026-04-21 16:00:01] swarm.bully_election - INFO - [drone_0] Starting election (depth=50.0, battery=100.0)
[2026-04-21 16:00:05] swarm.bully_election - INFO - [drone_0] Elected as leader
[2026-04-21 16:00:10] swarm.partition_handler - INFO - [drone_0] Partition state change: healthy -> degraded
```

### Viewing Election Results

```bash
# Monitor election events
python scripts/run_5drone_p2p.py --scenario healthy --duration-s 60 2>&1 | grep -i election
```

### Viewing Partition Detection

```bash
# Monitor partition events
python scripts/run_5drone_p2p.py --scenario partition --duration-s 60 2>&1 | grep -i partition
```

## Integration with Existing Code

### Using P2P Server in DroneController

```python
from swarm.p2p_server import P2PServer
from swarm.drone_controller import DroneController

# Create P2P server
p2p_server = P2PServer("drone_0", host="127.0.0.1", port=9001)
p2p_server.initialize()
p2p_server.start()

# Create drone controller
controller = DroneController(
    node_id="drone_0",
    robot=robot,
    scenario=scenario,
)

# Wire P2P messages to controller
def on_p2p_message(sender, msg):
    controller.handle_message(sender, msg)

p2p_server.on_message = on_p2p_message
```

### Using Bully Election in SwarmCoordinator

```python
from swarm.bully_election import BullyElection
from swarm.coordination.swarm_coordinator import SwarmCoordinator

# Create election
election = BullyElection(
    node_id="drone_0",
    all_nodes=["drone_0", "drone_1", "drone_2", "drone_3", "drone_4"],
    depth=50.0,
    battery=100.0,
)

# Use in coordinator
coordinator = SwarmCoordinator(node_id="drone_0", vertex=vertex, chain=chain)

# Tick election periodically
leader = election.tick()
if leader:
    print(f"Leader elected: {leader}")
```

### Using Partition Handler

```python
from swarm.partition_handler import PartitionHandler

# Create handler
handler = PartitionHandler("drone_0")
handler.set_expected_peers(["drone_0", "drone_1", "drone_2", "drone_3", "drone_4"])

# Record heartbeats
handler.record_heartbeat("drone_1")

# Check partition status
status = handler.tick()
if handler.is_partitioned():
    print("Network is partitioned!")
    # Take recovery action
```

## Testing

### Unit Tests

Run the existing test suite:

```bash
pytest swarm/tests/ -v
```

### Integration Test

Run the 5-drone coordinator with all scenarios:

```bash
for scenario in healthy degraded congested blackout partition recovery; do
  echo "Testing $scenario scenario..."
  python scripts/run_5drone_p2p.py --scenario $scenario --duration-s 30
done
```

## Troubleshooting

### Port Already in Use

If you get "Address already in use" errors:

```bash
# Kill existing processes
pkill -f "run_5drone_p2p"
pkill -f "p2p_server"

# Or use different ports
python scripts/run_5drone_p2p.py --scenario healthy --duration-s 60
```

### Import Errors

If you get import errors:

```bash
# Add swarm module to PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Or run from project root
cd /path/to/improved_swarm
python scripts/run_5drone_p2p.py --scenario healthy --duration-s 60
```

### Flask/SocketIO Not Installed

```bash
pip install flask flask-socketio
```

## Performance Notes

- **Memory**: ~50MB per drone (P2P server + coordinator)
- **CPU**: <1% per drone (idle)
- **Network**: ~50 KB/s (10Hz heartbeats, 5 drones)
- **Latency**: <10ms (local simulation)

## Next Steps

1. Integrate with frontend dashboard (Lovable)
2. Add Byzantine fault tolerance
3. Implement multi-hop relay chains
4. Add adaptive timeout tuning
5. Extend to 10+ drones
