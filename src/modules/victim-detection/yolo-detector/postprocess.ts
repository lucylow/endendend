import type { VictimDetection } from "../types";
import { xywhNormFromLetterbox } from "./preprocess";

export interface YoloOutputTensor {
  dims: readonly number[];
  data: Float32Array;
}

const COCO_PERSON = 0;

function iou(a: VictimDetection, b: VictimDetection): number {
  const ax2 = a.bbox.x + a.bbox.w;
  const ay2 = a.bbox.y + a.bbox.h;
  const bx2 = b.bbox.x + b.bbox.w;
  const by2 = b.bbox.y + b.bbox.h;
  const ix1 = Math.max(a.bbox.x, b.bbox.x);
  const iy1 = Math.max(a.bbox.y, b.bbox.y);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const u = a.bbox.w * a.bbox.h + b.bbox.w * b.bbox.h - inter;
  return u <= 0 ? 0 : inter / u;
}

function nms(dets: VictimDetection[], thr: number): VictimDetection[] {
  const sorted = [...dets].sort((p, q) => q.confidence - p.confidence);
  const out: VictimDetection[] = [];
  while (sorted.length) {
    const cur = sorted.shift()!;
    out.push(cur);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (iou(cur, sorted[i]!) > thr) sorted.splice(i, 1);
    }
  }
  return out;
}

/**
 * Ultralytics YOLOv8 ONNX: output [1, 4+nc, N] (e.g. [1, 84, 8400] for COCO).
 */
export function postprocessYOLOv8Output(
  tensor: YoloOutputTensor,
  confThreshold: number,
  frameW: number,
  frameH: number,
  scale: number,
  padX: number,
  padY: number,
  personOnly = true,
): VictimDetection[] {
  const dims = tensor.dims;
  const data = tensor.data;
  if (dims.length !== 3) return [];

  const _b = dims[0]!;
  const feat = dims[1]!;
  const n = dims[2]!;
  if (feat < 5 || n < 1) return [];

  const nc = feat - 4;
  const raw: VictimDetection[] = [];

  for (let i = 0; i < n; i++) {
    let best = 0;
    let cls = 0;
    for (let k = 0; k < nc; k++) {
      const s = data[(4 + k) * n + i]!;
      if (s > best) {
        best = s;
        cls = k;
      }
    }
    if (personOnly && cls !== COCO_PERSON) continue;
    if (best < confThreshold) continue;

    const cx = data[0 * n + i]!;
    const cy = data[1 * n + i]!;
    const bw = data[2 * n + i]!;
    const bh = data[3 * n + i]!;
    const box = xywhNormFromLetterbox(cx, cy, bw, bh, frameW, frameH, scale, padX, padY);

    raw.push({
      id: `det-${i}-${cls}`,
      bbox: box,
      confidence: best,
      classId: cls,
      label: cls === COCO_PERSON ? "person" : `class_${cls}`,
    });
  }

  return nms(raw, 0.45).slice(0, 32);
}
