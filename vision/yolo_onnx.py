"""YOLOv8 ONNX postprocess + NMS (Ultralytics-style [1, 4+nc, N] output). CPU / numpy only."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Sequence, Tuple

import numpy as np


@dataclass(frozen=True)
class Detection:
    x1: float
    y1: float
    x2: float
    y2: float
    score: float
    cls: int


def letterbox(
    image_bgr: np.ndarray,
    new_shape: Tuple[int, int] = (640, 640),
) -> Tuple[np.ndarray, float, Tuple[int, int]]:
    """Resize with aspect ratio; pad to square. Returns (tensor-ready BCHW slice 1x3xHxW input, ratio, (dw,dh))."""
    import cv2

    h, w = image_bgr.shape[:2]
    nw, nh = new_shape
    r = min(nw / w, nh / h)
    rw, rh = int(round(w * r)), int(round(h * r))
    resized = image_bgr if (rw, rh) == (w, h) else cv2.resize(image_bgr, (rw, rh), interpolation=cv2.INTER_LINEAR)
    dw, dh = nw - rw, nh - rh
    dw //= 2
    dh //= 2
    out = np.full((nh, nw, 3), 114, dtype=np.uint8)
    out[dh : dh + rh, dw : dw + rw] = resized
    blob = out[:, :, ::-1].transpose(2, 0, 1)[np.newaxis].astype(np.float32) / 255.0
    return blob, r, (dw, dh)


def _xywh2xyxy(box: np.ndarray) -> np.ndarray:
    xy = box.copy()
    xy[:, 0] = box[:, 0] - box[:, 2] / 2
    xy[:, 1] = box[:, 1] - box[:, 3] / 2
    xy[:, 2] = box[:, 0] + box[:, 2] / 2
    xy[:, 3] = box[:, 1] + box[:, 3] / 2
    return xy


def _nms(boxes: np.ndarray, scores: np.ndarray, iou_thres: float = 0.45) -> List[int]:
    if len(boxes) == 0:
        return []
    x1, y1, x2, y2 = boxes.T
    areas = (x2 - x1).clip(0) * (y2 - y1).clip(0)
    order = scores.argsort()[::-1]
    keep: List[int] = []
    while order.size > 0:
        i = int(order[0])
        keep.append(i)
        if order.size == 1:
            break
        rest = order[1:]
        xx1 = np.maximum(x1[i], x1[rest])
        yy1 = np.maximum(y1[i], y1[rest])
        xx2 = np.minimum(x2[i], x2[rest])
        yy2 = np.minimum(y2[i], y2[rest])
        inter = (xx2 - xx1).clip(0) * (yy2 - yy1).clip(0)
        union = areas[i] + areas[rest] - inter + 1e-9
        iou = inter / union
        order = rest[iou < iou_thres]
    return keep


def postprocess_yolov8(
    output: np.ndarray,
    conf_thres: float,
    ratio: float,
    pad: Tuple[int, int],
    orig_shape: Tuple[int, int],
    *,
    max_det: int = 32,
) -> List[Detection]:
    """output: [1, 4+nc, N] float32."""
    if output.ndim != 3:
        return []
    _b, ch, n = output.shape
    if ch < 5 or n < 1:
        return []
    nc = ch - 4
    preds = output[0].T  # [N, 4+nc]
    boxes = preds[:, :4]
    cls_scores = preds[:, 4:] if nc > 1 else preds[:, 4:5]
    scores = cls_scores.max(axis=1)
    cls_ids = cls_scores.argmax(axis=1)
    mask = scores >= conf_thres
    boxes = boxes[mask]
    scores = scores[mask]
    cls_ids = cls_ids[mask]
    if len(boxes) == 0:
        return []
    boxes = _xywh2xyxy(boxes)
    pad_w, pad_h = pad
    orig_h, orig_w = orig_shape
    boxes[:, [0, 2]] -= pad_w
    boxes[:, [1, 3]] -= pad_h
    boxes /= ratio + 1e-9
    boxes[:, [0, 2]] = boxes[:, [0, 2]].clip(0, orig_w)
    boxes[:, [1, 3]] = boxes[:, [1, 3]].clip(0, orig_h)
    keep_idx = _nms(boxes, scores)
    dets: List[Detection] = []
    for i in keep_idx[:max_det]:
        x1, y1, x2, y2 = boxes[i].tolist()
        dets.append(Detection(x1, y1, x2, y2, float(scores[i]), int(cls_ids[i])))
    return dets


def run_session(
    session: object,
    input_name: str,
    image_bgr: np.ndarray,
    conf_thres: float,
) -> List[Detection]:
    blob, ratio, pad = letterbox(image_bgr)
    outs = session.run(None, {input_name: blob})
    out0 = np.asarray(outs[0], dtype=np.float32)
    h, w = image_bgr.shape[:2]
    return postprocess_yolov8(out0, conf_thres, ratio, pad, (h, w))
