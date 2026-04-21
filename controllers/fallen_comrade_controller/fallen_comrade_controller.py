#!/usr/bin/env python3
"""
Webots controller: steps MockDataEngine at the simulator clock and mirrors state to ws://127.0.0.1:8765.

Attach to the `fallen_comrade_emitter` robot in `worlds/fallen_comrade_track2.wbt`.
Requires: pip install -r requirements-mockdata.txt
"""

from __future__ import annotations

import sys
import traceback
from pathlib import Path

from controller import Robot

_ROOT = Path(__file__).resolve().parents[2]
_SRC = _ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from mockdata.ws_runner import WsFallenComradeHub  # noqa: E402


def main() -> None:
    robot = Robot()
    timestep_ms = int(robot.getBasicTimeStep())
    hub = WsFallenComradeHub()
    try:
        hub.start_ws("127.0.0.1", 8765, external_step=True)
    except Exception:
        traceback.print_exc()
    while robot.step(timestep_ms) != -1:
        hub.step(timestep_ms / 1000.0)


if __name__ == "__main__":
    main()
