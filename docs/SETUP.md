# One-command setup (judges + contributors)

## Prereqs

- Docker Desktop with **Linux containers** (Windows hosts: enable WSL2 backend).
- Optional: local Webots R2023b+ if you prefer bare-metal sim.

## Full stack (Webots + ROS 2 swarm)

```bash
git clone https://github.com/lucylow/endendend.git
cd endendend
make demo
```

`make demo` runs `docker compose up --build`, which starts:

1. `webots` — loads `worlds/blackout_swarm.wbt` in fast batch mode.
2. `swarm` — builds `docker/Dockerfile.ros2` and launches `endendend_launch` for five drones.

Environment:

- `VERTEX_SEED=42` is passed into the swarm container for reproducible randomness in higher layers.

## Python coordination tests only

```bash
pip install -r requirements-coord.txt
PYTHONPATH=. python -m pytest tests/test_state_machine.py tests/golden_scenarios.py -v
```

Optional strict coverage on the FSM module:

```bash
PYTHONPATH=. python -m pytest tests/test_state_machine.py tests/golden_scenarios.py \
  --cov=swarm.coordination.state_machine --cov-report=term-missing --cov-fail-under=95
```

## Docs bundle

```bash
make docs
```

Produces `docs/ARCH_bundle.md`. If `@mermaid-js/mermaid-cli` (`mmdc`) is installed globally, PNGs are written under `docs/png/`.

## Failure-injection UI (local)

```bash
pip install -r requirements-coord.txt
python demo/injection_ui.py
```

Use the documented HTTP routes to trigger scripted failures while Webots / ROS are running.

## ROS-only compose (optional)

The historical file `docker-compose.ros2.yml` keeps `webots` behind a `sim` profile; use it when you want ROS without automatically pulling the simulator.
