#!/usr/bin/env python3
"""Placeholder controller: use ``webots.sim.failure_injector`` from ``scenario_supervisor``."""

from __future__ import annotations

from controller import Robot  # type: ignore


def main() -> None:
    robot = Robot()
    timestep = int(robot.getBasicTimeStep())
    while robot.step(timestep) != -1:
        pass


if __name__ == "__main__":
    main()
