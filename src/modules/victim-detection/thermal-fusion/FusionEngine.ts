import type { Position } from "@/types";
import type { FusedVictim, ThermalImage, VictimDetection } from "../types";
import { KalmanFilter1D } from "./kalmanFilter";

function sampleThermalBBox(thermal: ThermalImage, bbox: VictimDetection["bbox"]): number {
  const x0 = Math.floor(bbox.x * thermal.width);
  const y0 = Math.floor(bbox.y * thermal.height);
  const x1 = Math.min(thermal.width - 1, Math.ceil((bbox.x + bbox.w) * thermal.width));
  const y1 = Math.min(thermal.height - 1, Math.ceil((bbox.y + bbox.h) * thermal.height));
  let sum = 0;
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      sum += thermal.heat[y * thermal.width + x] ?? 0;
      n += 1;
    }
  }
  return n > 0 ? sum / n : 0;
}

function bboxToWorld(bbox: FusedVictim["bbox"], base: Position): Position {
  return {
    x: base.x + (bbox.x + bbox.w / 2 - 0.5) * 18,
    y: base.y,
    z: base.z + (bbox.y + bbox.h / 2 - 0.5) * 18,
  };
}

export class ThermalVisionFusion {
  private kalmanById = new Map<string, KalmanFilter1D>();

  fuse(
    rgbDetections: VictimDetection[],
    thermalData: ThermalImage,
    worldHint: Position,
    urgencyById?: Record<string, number>,
  ): FusedVictim[] {
    return rgbDetections.map((detection, idx) => {
      const thermalConfidence = sampleThermalBBox(thermalData, detection.bbox);
      const fusedRaw = 0.7 * detection.confidence + 0.3 * thermalConfidence;
      let k = this.kalmanById.get(detection.id);
      if (!k) {
        k = new KalmanFilter1D();
        this.kalmanById.set(detection.id, k);
      }
      const fusedScore = Math.max(0, Math.min(1, k.update(fusedRaw)));
      const urgency = urgencyById?.[detection.id] ?? 0.65 + (idx % 5) * 0.05;
      const worldPos = bboxToWorld(detection.bbox, worldHint);
      const priority = fusedScore * urgency;

      return {
        ...detection,
        thermalConfidence,
        fusedScore,
        urgency,
        worldPos,
        priority,
      };
    });
  }

  reset(): void {
    this.kalmanById.clear();
  }

  /** Synthetic thermal plane matching frame size (demo / no FLIR). */
  static syntheticThermal(width: number, height: number, seed: number): ThermalImage {
    const heat = new Float32Array(width * height);
    const cx = 0.45 + 0.1 * Math.sin(seed * 0.01);
    const cy = 0.5 + 0.08 * Math.cos(seed * 0.013);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const ny = y / height;
        const d = (nx - cx) ** 2 + (ny - cy) ** 2;
        heat[y * width + x] = Math.max(0, 1 - d * 4) * (0.55 + 0.45 * Math.sin(seed * 0.02 + x * 0.02));
      }
    }
    return { width, height, heat };
  }
}
