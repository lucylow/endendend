"""ONNXRuntime YOLOv8 wrapper (shared by ROS nodes and offline tools)."""

from __future__ import annotations

import os
from typing import List

import numpy as np
import onnxruntime as ort

from vision.yolo_onnx import Detection, letterbox, postprocess_yolov8


class YOLOv8Detector:
    def __init__(self, model_path: str, *, intra_threads: int = 4) -> None:
        mp = os.path.expanduser(model_path)
        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        opts.intra_op_num_threads = int(os.environ.get("ORT_INTRA_THREADS", str(intra_threads)))
        self.session = ort.InferenceSession(mp, sess_options=opts, providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name

    def infer(self, image_bgr: np.ndarray, conf_thres: float) -> List[Detection]:
        blob, ratio, pad = letterbox(image_bgr)
        out = self.session.run(None, {self.input_name: blob})[0]
        arr = np.asarray(out, dtype=np.float32)
        h, w = image_bgr.shape[:2]
        return postprocess_yolov8(arr, conf_thres, ratio, pad, (h, w))
