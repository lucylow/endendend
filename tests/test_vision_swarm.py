"""Smoke tests for vision helpers (no ROS runtime required)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from vision.detection_to_vertex import estimate_world_location, tracked_to_victim_messages
from vision.victim_tracker import TrackedVictim


class TestVisionSwarm(unittest.TestCase):
    def test_tracked_to_vertex_payload(self) -> None:
        tracks = [
            TrackedVictim(1, (100.0, 120.0, 200.0, 280.0), 0.9, 3),
        ]
        msgs = tracked_to_victim_messages("drone_0", tracks, (5.0, 5.0, 2.0), (640, 480))
        self.assertEqual(len(msgs), 1)
        self.assertEqual(msgs[0]["type"], "VICTIM_DETECTED")
        self.assertEqual(msgs[0]["sensor"], "yolov8_onnx")

    def test_estimate_world_monotonic(self) -> None:
        a = estimate_world_location((0.0, 0.0, 0.0), (10.0, 10.0, 100.0, 200.0), 640, 480)
        b = estimate_world_location((0.0, 0.0, 0.0), (540.0, 10.0, 630.0, 200.0), 640, 480)
        self.assertNotEqual(a[0], b[0])


if __name__ == "__main__":
    unittest.main()
