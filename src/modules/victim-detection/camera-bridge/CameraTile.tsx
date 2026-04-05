import { useEffect, useRef } from "react";
import type { CameraFeedState, VictimDetection } from "../types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  detections: VictimDetection[],
  thermalTint: boolean,
) {
  ctx.save();
  if (thermalTint) {
    ctx.fillStyle = "rgba(249, 115, 22, 0.12)";
    ctx.fillRect(0, 0, w, h);
  }
  for (const d of detections) {
    const x = d.bbox.x * w;
    const y = d.bbox.y * h;
    const bw = d.bbox.w * w;
    const bh = d.bbox.h * h;
    ctx.strokeStyle = "rgba(34, 211, 238, 0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, bw, bh);
    ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
    ctx.fillRect(x, Math.max(0, y - 18), Math.min(w - x, 120), 16);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillText(`${d.label} ${(d.confidence * 100).toFixed(0)}%`, x + 4, Math.max(10, y - 5));
  }
  ctx.restore();
}

const LABELS = ["UAV-1 RGB", "UAV-2 RGB", "Ground ROS2", "WebRTC relay"];

export function CameraTile({
  index,
  feed,
  videoRef,
  simCanvas,
  showThermal,
  frameTick,
}: {
  index: number;
  feed: CameraFeedState;
  videoRef: React.RefObject<HTMLVideoElement | null> | null;
  simCanvas: HTMLCanvasElement | null;
  showThermal: boolean;
  frameTick: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const label = LABELS[index] ?? feed.label;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth || 320;
    const h = c.clientHeight || 240;
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (index === 3 && feed.stream && videoRef?.current) {
      const v = videoRef.current;
      if (v.readyState >= 2) {
        ctx.drawImage(v, 0, 0, w, h);
      } else {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px ui-sans-serif, system-ui";
        ctx.fillText("WebRTC connecting…", 12, 28);
      }
    } else if (simCanvas) {
      ctx.drawImage(simCanvas, 0, 0, w, h);
    } else {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, w, h);
    }

    drawOverlay(ctx, w, h, feed.detections, showThermal);
  }, [feed, index, feed.stream, feed.detections, simCanvas, showThermal, videoRef, frameTick]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-black/40 shadow-inner",
        feed.connected ? "border-teal-500/35" : "border-zinc-700/80",
      )}
    >
      <canvas ref={canvasRef} className="h-44 w-full object-cover sm:h-52" />
      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
        <Badge variant="secondary" className="bg-black/55 text-[10px] uppercase tracking-wide text-zinc-200">
          {label}
        </Badge>
        <Badge variant="outline" className="border-teal-500/40 text-[10px] text-teal-200">
          {feed.source.replace("_", " ")}
        </Badge>
      </div>
      <div className="absolute bottom-2 right-2 rounded-md bg-black/55 px-2 py-0.5 font-mono text-[10px] text-cyan-200">
        pri {(feed.priority * 100).toFixed(0)}
      </div>
    </div>
  );
}
