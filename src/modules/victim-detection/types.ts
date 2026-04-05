import type { Position } from "@/types";

export interface BBoxNorm {
  /** 0–1 relative to frame width/height */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VictimDetection {
  id: string;
  bbox: BBoxNorm;
  confidence: number;
  classId: number;
  label: string;
}

export interface ThermalImage {
  width: number;
  height: number;
  /** Grayscale heat 0–1 per pixel, row-major */
  heat: Float32Array;
}

export interface FusedVictim extends VictimDetection {
  thermalConfidence: number;
  fusedScore: number;
  urgency: number;
  worldPos: Position;
  priority: number;
}

export interface VictimPriority {
  victimId: string;
  rank: number;
  consensusScore: number;
  fusedScore: number;
}

export interface CameraFeedState {
  id: string;
  label: string;
  source: "webrtc" | "ros2_sim" | "px4_sim";
  stream: MediaStream | null;
  detections: VictimDetection[];
  priority: number;
  connected: boolean;
}
