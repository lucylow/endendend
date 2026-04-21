#!/usr/bin/env python3
"""Webots entry: adds repo root to ``sys.path`` and runs ``swarm.webots_controller``."""

from __future__ import annotations

import os
import sys

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from swarm.webots_controller import launch_controller  # noqa: E402


def main() -> None:
    c = launch_controller()
    c.run()


if __name__ == '__main__':
    main()
