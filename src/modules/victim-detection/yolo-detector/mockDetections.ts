import type { VictimDetection } from "../types";

/** Deterministic SAR-style boxes when no ONNX model / camera variance. */
export function mockDetectionsFromFrame(seed: number, frameW: number, frameH: number): VictimDetection[] {
  const rnd = (i: number) => {
    const x = Math.sin(seed * 0.001 + i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  const n = 1 + Math.floor(rnd(0) * 3);
  const out: VictimDetection[] = [];
  for (let i = 0; i < n; i++) {
    const w = 0.08 + rnd(i + 1) * 0.12;
    const h = 0.18 + rnd(i + 2) * 0.22;
    const x = 0.1 + rnd(i + 3) * (0.85 - w);
    const y = 0.08 + rnd(i + 4) * (0.82 - h);
    const confidence = 0.55 + rnd(i + 5) * 0.42;
    out.push({
      id: `mock-${seed}-${i}`,
      bbox: { x, y, w, h },
      confidence,
      classId: 0,
      label: "person",
    });
  }
  return out;
}
