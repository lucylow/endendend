const MEAN = [0, 0, 0];
const STD = [1, 1, 1];

/**
 * Letterbox frame to `size`×`size` RGB CHW float32 [1,3,H,W] for YOLOv8 ONNX.
 */
export function letterboxToTensor(
  frame: ImageData,
  size: number,
): { tensorData: Float32Array; scale: number; padX: number; padY: number } {
  const { width: W, height: H, data } = frame;
  const scale = Math.min(size / W, size / H);
  const nw = Math.round(W * scale);
  const nh = Math.round(H * scale);
  const padX = Math.floor((size - nw) / 2);
  const padY = Math.floor((size - nh) / 2);

  const tensorData = new Float32Array(1 * 3 * size * size);
  const fill = 114 / 255;
  tensorData.fill(fill);

  for (let c = 0; c < 3; c++) {
    const planeOffset = c * size * size;
    for (let y = 0; y < nh; y++) {
      const sy = Math.min(H - 1, Math.floor(y / scale));
      for (let x = 0; x < nw; x++) {
        const sx = Math.min(W - 1, Math.floor(x / scale));
        const i = (sy * W + sx) * 4;
        const v = (data[i + c] / 255 - MEAN[c]) / STD[c];
        const tx = padX + x;
        const ty = padY + y;
        tensorData[planeOffset + ty * size + tx] = v;
      }
    }
  }

  return { tensorData, scale, padX, padY };
}

export function xywhNormFromLetterbox(
  cx: number,
  cy: number,
  w: number,
  h: number,
  frameW: number,
  frameH: number,
  scale: number,
  padX: number,
  padY: number,
): { x: number; y: number; w: number; h: number } {
  const x1 = (cx - w / 2 - padX) / scale;
  const y1 = (cy - h / 2 - padY) / scale;
  const bw = w / scale;
  const bh = h / scale;
  return {
    x: Math.max(0, Math.min(1, x1 / frameW)),
    y: Math.max(0, Math.min(1, y1 / frameH)),
    w: Math.max(0, Math.min(1, bw / frameW)),
    h: Math.max(0, Math.min(1, bh / frameH)),
  };
}
