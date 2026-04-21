#!/usr/bin/env python3
"""Placeholder ground rover controller — kinematics + bids live in `BlindHandoffEngine`."""

from __future__ import annotations

from controller import Robot


def main() -> None:
    robot = Robot()
    timestep_ms = int(robot.getBasicTimeStep())
    while robot.step(timestep_ms) != -1:
        pass


if __name__ == "__main__":
    main()
