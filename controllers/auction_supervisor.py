#!/usr/bin/env python3
"""
Optional supervisor: attach when you want auction/replay logging without stepping physics.

By default the aerial emitter already runs `WsHandoffHub`; use this only if you split roles.
"""

from __future__ import annotations

from controller import Supervisor


def main() -> None:
    sup = Supervisor()
    timestep_ms = int(sup.getBasicTimeStep())
    while sup.step(timestep_ms) != -1:
        pass


if __name__ == "__main__":
    main()
