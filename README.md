# Tashi Swarm Search & Rescue

A **decentralized swarm** of drones and rovers that autonomously coordinate search-and-rescue missions using **Vertex P2P messaging** — no cloud dependency, no single point of failure.

Built for the Tashi hackathon. The system demonstrates three core scenarios in simulation (Webots) and a real-time React dashboard.

---

## Features

| Scenario | What happens |
|---|---|
| **Dynamic Daisy Chain** | Drones form a self-healing relay chain through a tunnel, inserting new relays as signal degrades |
| **Fallen Comrade** | When a rover dies, its search sector is redistributed among survivors via gossip consensus |
| **Blind Handoff** | Aerial drone spots a victim, hands off rescue to the nearest ground rover using distance-based bidding |

**Additional capabilities:**
- BFT (Byzantine Fault Tolerant) consensus for task acceptance
- Per-link network emulation with configurable loss, latency, and asymmetry
- Stake-weighted trust scoring via on-chain $TASHI staking
- Real-time 3D swarm visualization (React Three Fiber)
- Structured event logging and metrics collection

---

## Getting Started

### Prerequisites

- **Python 3.9+** — backend swarm logic and Webots controllers
- **Node.js 18+** — React frontend
- **Webots R2025a** *(optional)* — 3D robot simulation

### Installation

```bash
git clone <repo-url>
cd swarm_project

# Python dependencies
pip install -r requirements.txt

# Frontend
npm install
```

### Running the Frontend

```bash
npm run dev
# → http://localhost:5173
```

### Running Swarm Scenarios (Python)

```bash
# Headless multi-drone simulation
PYTHONPATH=. python swarm/demo_mesh_http.py

# With Webots world
./scripts/run_webots.sh worlds/tunnel.wbt
```

### Running Tests

```bash
# Python unit tests
pytest swarm/tests/

# Frontend tests
npm test
```

---

## Configuration

All tunable parameters live in two places:

| File | Purpose |
|---|---|
| `swarm/config.py` | Python: grid size, drone speed, victim positions, FoxMQ settings |
| `src/config/foxmq.ts` | TypeScript: broker host/port, replication factor |
| `src/config/swarmRobustness.ts` | TypeScript: heartbeat intervals, peer timeouts, relay distances |
| `config/default.yaml` | YAML: scenario-level overrides (grid, network, roles, handoff) |

Environment variables (`VITE_FOXMQ_HOST`, `VITE_SWARM_WS_URL`, etc.) override defaults for deployment.

---

## Code Structure

```
├── swarm/                     # Python swarm backend
│   ├── config.py              # Grid, motion, target, FoxMQ constants
│   ├── vertex_node.py         # P2P broadcast abstraction
│   ├── chain_manager.py       # Relay-chain role coordination
│   ├── exploration.py         # Gossip-based grid exploration + claims
│   ├── target_manager.py      # Victim detection, gossip, distance-based claiming
│   ├── drone_controller.py    # Main control loop (explore / relay / rescue)
│   ├── network_simulator.py   # Per-link loss/latency + scenario timelines
│   ├── network_emulator.py    # Fanout delivery with loss model
│   ├── persist.py             # Snapshot/restore exploration state
│   └── tests/                 # Unit tests for exploration, network, targets
│
├── src/                       # React + TypeScript frontend
│   ├── components/            # UI components (EventLog, Telemetry, 3D scenes)
│   ├── features/              # Domain logic (staking, websocket, swarm viz)
│   ├── pages/                 # Route pages (Landing, Dashboard, Docs, Scenarios)
│   ├── store/                 # Zustand stores (swarmStore, p2pStore)
│   ├── config/                # FoxMQ + robustness tuning
│   ├── lib/                   # Pathfinding, Tashi SDK bridge, utilities
│   └── types/                 # TypeScript interfaces
│
├── config/                    # YAML configuration files
│   └── default.yaml           # Scenario-level parameter overrides
│
├── reference/python/          # Reference FoxMQ client + persistence
├── public/                    # Static assets + reconnection script
└── docs/                      # Architecture and scenario documentation
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    React Dashboard                       │
│  (3D Viz · Event Log · Metrics · Scenario Controls)      │
└──────────────┬───────────────────────────┬───────────────┘
               │ WebSocket                 │ REST
               ▼                           ▼
┌──────────────────────┐    ┌──────────────────────────────┐
│  SwarmWebSocketClient │    │  Mesh Stats HTTP Server      │
│  (telemetry stream)   │    │  (link stats, swarm metrics) │
└──────────┬───────────┘    └──────────┬───────────────────┘
           │                           │
           ▼                           ▼
┌──────────────────────────────────────────────────────────┐
│                  DroneController (per agent)              │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Exploration │  │ ChainManager │  │  TargetManager  │  │
│  │  Manager    │  │  (roles)     │  │  (victim claim) │  │
│  └─────┬──────┘  └──────┬───────┘  └────────┬────────┘  │
│        │                │                    │           │
│        └────────┬───────┴────────────────────┘           │
│                 ▼                                        │
│          VertexNode (P2P broadcast)                       │
│                 │                                        │
│                 ▼                                        │
│       NetworkEmulator → NetworkSimulator                 │
│       (per-link loss, latency, scenario timeline)        │
└──────────────────────────────────────────────────────────┘
```

See `docs/architecture.md` for detailed data-flow and state-machine diagrams, and `docs/monetization.md` for the Nexus-aligned Swarm Commerce business model.

---

## Scenarios

### 1. Dynamic Daisy Chain
Drones enter a tunnel single-file. As the explorer moves deeper, signal degrades. The system autonomously inserts relay nodes to maintain connectivity. If a relay fails, the chain self-heals.

### 2. Fallen Comrade
Five rovers divide a search grid into sectors. When one rover dies (battery or fault), its sector is redistributed among survivors using gossip-based consensus. No central coordinator.

### 3. Blind Handoff
An aerial drone detects a victim but has low battery. It broadcasts a `TARGET_ANNOUNCEMENT`. Ground rovers bid based on distance. The closest rover claims the target and navigates to rescue.

## License

MIT
