#!/usr/bin/env python3
"""
Webots clock driver for the Blind Handoff mock hub (same contract as `blind_handoff_emitter`).

Steps `WsHandoffHub` on the simulator timestep and broadcasts Track 2 JSON on ws://127.0.0.1:8765.
"""

from __future__ import annotations

import sys
import traceback
from pathlib import Path

from controller import Robot

_ROOT = Path(__file__).resolve().parents[1]
_SRC = _ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from mockdata.ws_handoff_runner import WsHandoffHub  # noqa: E402


def main() -> None:
    robot = Robot()
    timestep_ms = int(robot.getBasicTimeStep())
    hub = WsHandoffHub()
    try:
        hub.start_ws("127.0.0.1", 8765, external_step=True)
    except Exception:
        traceback.print_exc()
    while robot.step(timestep_ms) != -1:
        hub.step(timestep_ms / 1000.0)


if __name__ == "__main__":
    main()
