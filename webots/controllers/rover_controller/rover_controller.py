#!/usr/bin/env python3
"""Minimal ground rover controller (placeholder dynamics; supervisor owns telemetry)."""

from __future__ import annotations

from controller import Robot  # type: ignore


def main() -> None:
    robot = Robot()
    timestep = int(robot.getBasicTimeStep())
    while robot.step(timestep) != -1:
        pass


if __name__ == "__main__":
    main()
