"""Lightweight checks (no full launch graph). Run with ``pytest test/test_ros2_swarm.py``."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path


def _ws_src() -> Path:
    root = Path(__file__).resolve().parents[1]
    return root / 'colcon_ws' / 'src'


def test_qos_profiles_importable() -> None:
    pytest = importlib.import_module('pytest')
    pytest.importorskip('rclpy')
    src = _ws_src().parent  # colcon_ws/src
    sys.path.insert(0, str(src))
    qos = importlib.import_module('endendend_core.qos_profiles')
    assert qos.SWARM_QOS.depth == 10
    assert qos.CRITICAL_QOS.depth == 5


def test_msgs_path_exists() -> None:
    msgs = _ws_src() / 'endendend_msgs' / 'msg'
    srv = _ws_src() / 'endendend_msgs' / 'srv'
    assert (msgs / 'DroneState.msg').is_file()
    assert (msgs / 'SwarmGlobalState.msg').is_file()
    assert (srv / 'InjectFailure.srv').is_file()
