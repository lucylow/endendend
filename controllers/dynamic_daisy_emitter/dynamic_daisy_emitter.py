#!/usr/bin/env python3
"""Webots Supervisor: reads DEF ``DRONE0``…``DRONE4``, runs Dynamic Daisy engine, 60 Hz WS + motion targets."""

from __future__ import annotations

import sys
import traceback
from pathlib import Path
from typing import Dict, Tuple

try:
    from controller import Supervisor
except ImportError as exc:  # pragma: no cover
    print("Webots controller module not found:", exc, file=sys.stderr)
    sys.exit(1)

_HERE = Path(__file__).resolve()
_ROOT = _HERE.parents[2]
_SRC = _ROOT / "src"
_CTR_SRC = _ROOT / "controllers" / "src"
for p in (_CTR_SRC, _SRC):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from dynamic_daisy_engine import DynamicDaisyEngine  # noqa: E402
from mockdata.ws_dynamic_daisy_hub import WsDynamicDaisyWebotsHub  # noqa: E402


def _read_positions(sup: Supervisor) -> Dict[str, Tuple[float, float, float]]:
    out: Dict[str, Tuple[float, float, float]] = {}
    for i in range(5):
        node = sup.getFromDef(f"DRONE{i}")
        if node is None:
            continue
        tr = node.getField("translation")
        if tr is None:
            continue
        v = tr.getSFVec3f()
        out[f"drone_{i}"] = (float(v[0]), float(v[1]), float(v[2]))
    return out


def main() -> None:
    sup = Supervisor()
    timestep_ms = int(sup.getBasicTimeStep())
    dt = timestep_ms / 1000.0
    engine = DynamicDaisyEngine(seed=42)
    hub = WsDynamicDaisyWebotsHub(engine, _ROOT)
    try:
        hub.start_ws("127.0.0.1", 8765, external_step=True)
    except Exception:
        traceback.print_exc()
    while sup.step(timestep_ms) != -1:
        positions = _read_positions(sup)
        hub.step(dt, positions)


if __name__ == "__main__":
    main()
