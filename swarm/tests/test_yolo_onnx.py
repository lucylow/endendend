"""Unit tests for YOLOv8 ONNX postprocess (numpy)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from vision.yolo_onnx import postprocess_yolov8


class TestYoloOnnxPostprocess(unittest.TestCase):
    def test_single_strong_detection(self) -> None:
        n = 128
        nc = 1
        ch = 4 + nc
        out = np.zeros((1, ch, n), dtype=np.float32)
        i = 10
        out[0, 0, i] = 320.0
        out[0, 1, i] = 320.0
        out[0, 2, i] = 80.0
        out[0, 3, i] = 120.0
        out[0, 4, i] = 0.95
        dets = postprocess_yolov8(out, 0.5, ratio=1.0, pad=(0, 0), orig_shape=(640, 640))
        self.assertGreaterEqual(len(dets), 1)
        self.assertGreater(dets[0].score, 0.5)


if __name__ == "__main__":
    unittest.main()
