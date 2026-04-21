#!/usr/bin/env python3
"""Mission supervisor stub — extend for multi-robot coordination or recording hooks."""

from __future__ import annotations

from controller import Supervisor


def main() -> None:
    sup = Supervisor()
    timestep_ms = int(sup.getBasicTimeStep())
    while sup.step(timestep_ms) != -1:
        pass


if __name__ == "__main__":
    main()
