# Architecture — Vertex / Tashi blackout swarm

This monorepo keeps the **web dashboard** in TypeScript (`src/`) and **coordination + simulation** in Python (`swarm/`, `colcon_ws/`). The hackathon “single source of truth” for *mesh lifecycle* lives in `swarm/coordination/state_machine.py` alongside the existing runtime facades (`SwarmCoordinator`, `HeartbeatMonitor`).

## Coordination flow (judge view)

1. **Discovery** — heartbeats populate `BlackoutStateMachine.drones`.
2. **Forming** — once enough peers are live, the FSM arms chain policy.
3. **Explorer election** — deepest + highest trust + lexicographically smallest id (`BlackoutStateMachine.elect_explorer`).
4. **Exploring** — `ExplorerController` only moves the elected explorer id.
5. **Recovery** — quorum loss emits `ActionType.REBUILD_CHAIN` for the Webots / ROS layers to interpret.

## Diagrams

- State chart source: [`state-machine.mmd`](state-machine.mmd)
- Role dataflow sketch: [`roles.mmd`](roles.mmd)
- Bundled Mermaid for reviewers: run `make docs` → `docs/ARCH_bundle.md`

## Related runtime modules

| Layer | Module | Role |
| --- | --- | --- |
| Vertex / P2P | `swarm/vertex_node.py` | Broadcast + send |
| Chain roles | `swarm/chain_manager.py` | `DroneRole` enum |
| Liveness | `swarm/coordination/heartbeat_monitor.py` | Stale / dead classification |
| Facade | `swarm/coordination/swarm_coordinator.py` | Heartbeats + promotion hooks |

## Progressive reading

1. [`SETUP.md`](SETUP.md) — Docker + Make entrypoints
2. This file — system map
3. [`COORD-LOGIC.md`](COORD-LOGIC.md) — FSM decisions line by line
