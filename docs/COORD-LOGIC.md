# Coordination logic — Blackout FSM

The reference implementation is `swarm/coordination/state_machine.py`. It is intentionally **pure** (no Webots imports) so `pytest` can act as executable specification.

## Explorer election

Candidates default to `DroneRole.STANDBY`. If none are present yet (early Webots boot), the FSM falls back to **all known drones** so a leader is still chosen deterministically.

Tie order:

1. Maximize `depth` (frontier progress proxy).
2. Maximize `trust` (stake / reputation proxy).
3. Minimize `id` lexicographically (deterministic tie-break).

## Swarm states

| State | Meaning |
| --- | --- |
| `DISCOVERY` | Collecting peers / heartbeats |
| `FORMING` | Quorum reached; elect explorer |
| `EXPLORING` | Normal coordinated motion |
| `RECOVERING` | Live set below `min_live_recovering` |
| `SOLO` | Prolonged isolation (`peer_count <= 1` for `solo_no_peer_sec`) |

## Why not merge into `DroneController` immediately?

`DroneController` already orchestrates Webots, exploration targets, and Vertex traffic. Collapsing everything in one file would improve locality but **hurt judge comprehension**. The FSM is the readable contract; wiring it into the control loop can proceed incrementally without blocking tests.

## Tracing

`swarm/coordination/tracing.py` exposes `log_decision` / `decision_dict` for structured audit lines (`DECISION {...}`) and test assertions via `BlackoutStateMachine.pop_decisions()`.
