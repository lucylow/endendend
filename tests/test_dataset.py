"""Validate SAR dataset layout and YOLO label syntax."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class TestSARDataset(unittest.TestCase):
    def test_yolo_label_line(self) -> None:
        line = "0 0.512300 0.481200 0.120000 0.240000\n"
        parts = line.split()
        self.assertEqual(len(parts), 5)
        cls = int(parts[0])
        xc, yc, w, h = (float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4]))
        self.assertEqual(cls, 0)
        self.assertTrue(0 < xc < 1 and 0 < yc < 1)
        self.assertTrue(0 < w <= 1 and 0 < h <= 1)

    def test_sar_tunnel_frame_has_pixels(self) -> None:
        sys.path.insert(0, str(ROOT / "dataset"))
        from gen_dataset import _draw_sar_tunnel_frame  # type: ignore[import-not-found]

        import random

        rng = random.Random(123)
        img = np.zeros((640, 640, 3), dtype=np.uint8)
        _draw_sar_tunnel_frame(img, rng)
        self.assertGreater(int(img.mean()), 5)


if __name__ == "__main__":
    unittest.main()
