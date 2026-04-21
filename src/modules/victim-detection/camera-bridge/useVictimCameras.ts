import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductionYOLODetector } from "../yolo-detector/YOLODetector";
import type { CameraFeedState, VictimDetection } from "../types";

const W = 320;
const H = 240;

const SIM_LABELS = ["UAV-1 RGB", "UAV-2 RGB", "Ground ROS2", "WebRTC relay"];

function drawSimFrame(ctx: CanvasRenderingContext2D, seed: number, label: string) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0f172a");
  g.addColorStop(1, "#1e293b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const cx = W * (0.42 + 0.06 * Math.sin(seed * 0.03));
  const cy = H * (0.48 + 0.05 * Math.cos(seed * 0.027));
  const rad = 28 + Math.sin(seed * 0.04) * 6;
  const rg = ctx.createRadialGradient(cx, cy, 4, cx, cy, rad);
  rg.addColorStop(0, "rgba(251, 191, 36, 0.55)");
  rg.addColorStop(1, "rgba(251, 191, 36, 0)");
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(148, 163, 184, 0.35)";
  for (let i = 0; i < 40; i++) {
    const x = (Math.sin(seed * 0.01 + i * 11) * 0.5 + 0.5) * W;
    const y = (Math.cos(seed * 0.015 + i * 7) * 0.5 + 0.5) * H;
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
  ctx.font = "11px ui-monospace, monospace";
  ctx.fillText(label, 8, 16);
  ctx.fillText(`ROS2 /camera_${seed % 100}`, 8, 30);
}

export function useVictimCameras(
  detector: ProductionYOLODetector | null,
  options: { running: boolean; confThreshold: number; personOnly?: boolean },
) {
  const { running, confThreshold, personOnly = true } = options;
  const canvasesRef = useRef<HTMLCanvasElement[]>([]);
  const [feeds, setFeeds] = useState<CameraFeedState[]>(() => [
    { id: "cam-0", label: SIM_LABELS[0]!, source: "px4_sim", stream: null, detections: [], priority: 1, connected: true },
    { id: "cam-1", label: SIM_LABELS[1]!, source: "px4_sim", stream: null, detections: [], priority: 0.92, connected: true },
    { id: "cam-2", label: SIM_LABELS[2]!, source: "ros2_sim", stream: null, detections: [], priority: 0.88, connected: true },
    { id: "cam-3", label: SIM_LABELS[3]!, source: "webrtc", stream: null, detections: [], priority: 0.85, connected: false },
  ]);
  const [frameTick, setFrameTick] = useState(0);
  const tickRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const ensureCanvas = useCallback((index: number) => {
    let c = canvasesRef.current[index];
    if (!c) {
      c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      canvasesRef.current[index] = c;
    }
    return c;
  }, []);

  const attachWebRtc = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setFeeds((prev) =>
        prev.map((f, i) => (i === 3 ? { ...f, stream, connected: true, source: "webrtc" as const } : f)),
      );
    } catch {
      setFeeds((prev) => prev.map((f, i) => (i === 3 ? { ...f, connected: false } : f)));
    }
  }, []);

  const runFrame = useCallback(async () => {
    if (!detector) return;
    tickRef.current += 1;
    const t = tickRef.current;
    const nextDetections: VictimDetection[][] = [];

    for (let i = 0; i < 3; i++) {
      const c = ensureCanvas(i);
      const ctx = c.getContext("2d");
      if (!ctx) {
        nextDetections.push([]);
        continue;
      }
      drawSimFrame(ctx, t + i * 17, SIM_LABELS[i]!);
      const im = ctx.getImageData(0, 0, W, H);
      nextDetections.push(await detector.detect(im, confThreshold, personOnly));
    }

    const c3 = ensureCanvas(3);
    const ctx3 = c3.getContext("2d");
    if (!ctx3) {
      nextDetections.push([]);
    } else if (streamRef.current && videoRef.current && videoRef.current.readyState >= 2) {
      const v = videoRef.current;
      ctx3.drawImage(v, 0, 0, W, H);
      const im = ctx3.getImageData(0, 0, W, H);
      nextDetections.push(await detector.detect(im, confThreshold, personOnly));
    } else {
      drawSimFrame(ctx3, t + 99, "WebRTC (simulated)");
      const im = ctx3.getImageData(0, 0, W, H);
      nextDetections.push(await detector.detect(im, confThreshold, personOnly));
    }

    setFeeds((prev) =>
      prev.map((f, i) => ({
        ...f,
        detections: nextDetections[i] ?? [],
        priority: Math.min(0.99, 0.78 + (nextDetections[i]?.length ?? 0) * 0.07 + (i === 0 ? 0.05 : 0)),
      })),
    );
    setFrameTick((x) => x + 1);
  }, [detector, confThreshold, personOnly, ensureCanvas]);

  useEffect(() => {
    if (!running || !detector) return;
    let cancelled = false;
    let handle = 0;

    const loop = async () => {
      if (cancelled) return;
      await runFrame();
      handle = window.setTimeout(loop, 140);
    };
    void loop();
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [running, detector, runFrame]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, []);

  return { feeds, frameTick, canvasesRef, attachWebRtc, videoRef };
}
