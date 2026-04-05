# Architecture

## System Overview

The Tashi Swarm system is a **fully decentralized** multi-robot coordination platform. Every drone runs identical software — there is no leader, no cloud server, and no single point of failure.

### Layers

```
┌─────────────────────────────────────────┐
│            Behavior Layer               │
│  (exploration, rescue, relay holding)   │
├─────────────────────────────────────────┤
│          Coordination Layer             │
│  (ChainManager, TargetManager, BFT)    │
├─────────────────────────────────────────┤
│           Messaging Layer               │
│  (VertexNode → NetworkEmulator)         │
├─────────────────────────────────────────┤
│        Simulation / Hardware            │
│  (Webots controller or mock robot)      │
└─────────────────────────────────────────┘
```

## Component Responsibilities

| Component | File | Purpose |
|---|---|---|
| **VertexNode** | `swarm/vertex_node.py` | Single-hop P2P broadcast abstraction |
| **NetworkEmulator** | `swarm/network_emulator.py` | Fanout delivery with per-link loss model |
| **NetworkSimulator** | `swarm/network_simulator.py` | Directed link state, counters, scenario timelines |
| **ChainManager** | `swarm/chain_manager.py` | Role assignment (Explorer/Relay/Standby), message routing |
| **ExplorationManager** | `swarm/exploration.py` | Gossip-based grid exploration with timed claims |
| **TargetManager** | `swarm/target_manager.py` | Victim detection, announcement, distance-based claiming |
| **DroneController** | `swarm/drone_controller.py` | Main tick loop: explore → detect → rescue |
| **GridMap** | `swarm/exploration.py` | 2D cell tracking with soft reservations |

## Data Flow

### Message Types

| Message | Direction | Purpose |
|---|---|---|
| `EXPLORATION_UPDATE` | Broadcast | Share explored cells and claims |
| `VICTIM_DETECTED` | Broadcast | Raw sensor detection event |
| `TARGET_ANNOUNCEMENT` | Broadcast | Confirmed target with ID and location |
| `TARGET_CLAIM` | Broadcast | Distance-based bid for rescue assignment |
| `TARGET_RESOLVED` | Broadcast | Target rescued, remove from tracking |
| `HEARTBEAT` | Broadcast | Peer liveness |
| `ROLE_ANNOUNCE` | Broadcast | Role change notification |

### Exploration Gossip Flow

```
Drone A explores cell (3,4)
  → marks local GridMap
  → every 5s broadcasts EXPLORATION_UPDATE { cells: [[3,4]], claims: [...] }

Drone B receives update
  → merges into local GridMap
  → skips cells already explored
  → respects foreign claims (avoids duplicate work)
```

### Target Claim Flow

```
Drone A detects victim at (75, 75, 0)
  → creates Target with confidence > 0.7
  → broadcasts TARGET_ANNOUNCEMENT
  → calculates own distance, broadcasts TARGET_CLAIM

Drone B receives TARGET_ANNOUNCEMENT
  → calculates own distance
  → if closer: broadcasts competing TARGET_CLAIM
  → closer drone wins (tie-break: lexicographic ID)

Winner transitions behavior → "rescue"
  → navigates to target location
  → on arrival: broadcasts TARGET_RESOLVED
```

## State Machines

### DroneController Behavior

```
  ┌──────────┐
  │ explore  │ ←── default
  └────┬─────┘
       │ target claimed
       ▼
  ┌──────────┐
  │  rescue  │
  └────┬─────┘
       │ target resolved / lost
       ▼
  ┌──────────┐
  │ explore  │
  └──────────┘

  (relay role overrides explore → hold position)
```

### ChainManager Roles

```
  STANDBY ──→ EXPLORER  (depth-based election)
  STANDBY ──→ RELAY     (insertion request)
  EXPLORER ──→ STANDBY  (target claimed, handoff)
  RELAY ──→ STANDBY     (chain dissolved)
```

## Frontend Architecture

The React dashboard connects via WebSocket to receive real-time telemetry:

```
SwarmWebSocketClient
  ├── agentUpdates$    → Zustand swarmStore → 3D visualization
  ├── swarmStatus$     → swarmStore → TelemetryOverlay
  └── connectionStatus$ → swarmStore → WebSocketStatus badge
```

Key frontend stores:
- **swarmStore** (Zustand) — agents, events, exploration progress, consensus
- **p2pStore** — peer discovery and mesh topology
- **scenarioOrchestratorStore** — scenario playback state
