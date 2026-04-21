import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Camera, Sparkles, Video, VideoOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ProductionYOLODetector } from "@/modules/victim-detection";

type Det = { id: string; x: number; y: number; w: number; h: number; conf: number; fused: number; at: number; confirmed: boolean };

const BUF_W = 320;
const BUF_H = 240;
const DISP_W = 480;
const DISP_H = 270;

function drawDemoFrame(ctx: CanvasRenderingContext2D, seed: number) {
  const g = ctx.createLinearGradient(0, 0, BUF_W, BUF_H);
  g.addColorStop(0, "#0f172a");
  g.addColorStop(1, "#1e293b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, BUF_W, BUF_H);

  const cx = BUF_W * (0.42 + 0.06 * Math.sin(seed * 0.03));
  const cy = BUF_H * (0.48 + 0.05 * Math.cos(seed * 0.027));
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
    const x = (Math.sin(seed * 0.01 + i * 11) * 0.5 + 0.5) * BUF_W;
    const y = (Math.cos(seed * 0.015 + i * 7) * 0.5 + 0.5) * BUF_H;
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
  ctx.font = "11px ui-monospace, monospace";
  ctx.fillText("SAR demo feed (victim hotspot)", 8, 16);
  ctx.fillText(`frame ${seed % 10000}`, 8, 30);
}

export const YoloVisionPanel = memo(function YoloVisionPanel() {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [demoFeed, setDemoFeed] = useState(true);
  const [detector, setDetector] = useState<ProductionYOLODetector | null>(null);
  const [yoloPersonOnly, setYoloPersonOnly] = useState(true);
  const [dets, setDets] = useState<Det[]>([]);
  const [fused, setFused] = useState(0.42);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const tickRef = useRef(0);

  const ensureBuffer = useCallback(() => {
    let b = bufferRef.current;
    if (!b) {
      b = document.createElement("canvas");
      b.width = BUF_W;
      b.height = BUF_H;
      bufferRef.current = b;
    }
    return b;
  }, []);

  useEffect(() => {
    const d = new ProductionYOLODetector();
    const base = import.meta.env.BASE_URL;
    const devFallback = import.meta.env.DEV ? "mock" : "empty";
    void (async () => {
      const candidates = [
        `${base}models/victim_yolov8/best.onnx`,
        `${base}models/victim_yolov8n.onnx`,
        `${base}models/victim.onnx`,
        `${base}models/yolov8n.onnx`,
      ];
      for (const url of candidates) {
        await d.init(url, { fallback: "empty" });
        if (d.activeBackend === "onnx") {
          setYoloPersonOnly(!url.includes("victim"));
          setDetector(d);
          return;
        }
      }
      await d.init(`${base}models/yolov8n.onnx`, { fallback: devFallback });
      setYoloPersonOnly(true);
      setDetector(d);
    })();
    return () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      d.dispose();
    };
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
    setCameraError(null);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera API not available in this context (use HTTPS or localhost).");
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => undefined);
      }
      setCameraReady(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Permission denied or no camera.";
      setCameraError(msg);
      setCameraReady(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (demoFeed) {
      stopCamera();
      return;
    }
    void startCamera();
  }, [demoFeed, startCamera, stopCamera]);

  const confThreshold = 0.45;

  const runFrame = useCallback(async () => {
    if (!detector) return;
    tickRef.current += 1;
    const seed = tickRef.current;
    const buf = ensureBuffer();
    const bctx = buf.getContext("2d");
    if (!bctx) return;

    if (demoFeed) {
      drawDemoFrame(bctx, seed);
    } else {
      const v = videoRef.current;
      if (v && cameraReady && v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        bctx.drawImage(v, 0, 0, BUF_W, BUF_H);
      } else {
        bctx.fillStyle = "#0a0a0f";
        bctx.fillRect(0, 0, BUF_W, BUF_H);
        bctx.fillStyle = "#64748b";
        bctx.font = "12px ui-monospace, monospace";
        const line = cameraError ?? (cameraReady ? "Starting camera…" : "Waiting for camera…");
        bctx.fillText(line.slice(0, 48), 8, 28);
      }
    }

    const im = bctx.getImageData(0, 0, BUF_W, BUF_H);
    const raw = await detector.detect(im, confThreshold, yoloPersonOnly);
    const mapped: Det[] = raw.map((r) => ({
      id: r.id,
      x: r.bbox.x,
      y: r.bbox.y,
      w: r.bbox.w,
      h: r.bbox.h,
      conf: r.confidence,
      fused: Math.min(0.99, r.confidence * (demoFeed ? 0.92 : 0.88)),
      at: Date.now(),
      confirmed: r.confidence > 0.82,
    }));
    setDets(mapped.slice(0, 12));
    const top = mapped.reduce((m, x) => Math.max(m, x.conf), 0);
    setFused((prev) => (mapped.length ? Math.min(0.98, prev * 0.88 + top * 0.12 + 0.02) : prev * 0.97));

    const disp = displayRef.current;
    if (disp) {
      const ctx = disp.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#0a0a0f";
        ctx.fillRect(0, 0, DISP_W, DISP_H);
        ctx.drawImage(buf, 0, 0, DISP_W, DISP_H);
        ctx.strokeStyle = "#1e293b";
        for (let i = 0; i < 12; i++) {
          ctx.beginPath();
          ctx.moveTo((i / 12) * DISP_W, 0);
          ctx.lineTo((i / 12) * DISP_W, DISP_H);
          ctx.stroke();
        }
        for (const d of mapped) {
          const hue = d.conf > 0.75 ? "#22c55e" : d.conf > 0.5 ? "#eab308" : "#f97316";
          const px = d.x * DISP_W;
          const py = d.y * DISP_H;
          const pw = d.w * DISP_W;
          const ph = d.h * DISP_H;
          ctx.strokeStyle = hue;
          ctx.lineWidth = 2;
          ctx.strokeRect(px, py, pw, ph);
          ctx.fillStyle = `${hue}33`;
          ctx.fillRect(px, py, pw, ph);
        }
        ctx.fillStyle = "#94a3b8";
        ctx.font = "11px monospace";
        const mode = demoFeed ? "DEMO FEED + YOLOv8" : "WEBCAM + YOLOv8";
        const backend = detector.activeBackend === "onnx" ? "ONNX WASM" : "mock CV";
        ctx.fillText(`${mode} · ${backend}`, 10, 18);
      }
    }
  }, [cameraError, cameraReady, demoFeed, detector, ensureBuffer, yoloPersonOnly]);

  useEffect(() => {
    if (!detector) return;
    let cancelled = false;
    let handle = 0;
    const loop = async () => {
      if (cancelled) return;
      await runFrame();
      handle = window.setTimeout(loop, demoFeed ? 160 : 120);
    };
    void loop();
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [detector, runFrame, demoFeed]);

  return (
    <Card variant="mission" className="border-zinc-800" data-tour="vision">
      <CardHeader className="py-3 flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <Camera className="w-4 h-4 text-sky-400" aria-hidden />
            YOLO vision fusion
          </CardTitle>
          <CardDescription className="text-xs">RGB + thermal confidence before swarm confirmation.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {detector ? (
            <Badge variant="outline" className="font-mono text-[10px] border-zinc-600">
              {detector.activeBackend === "onnx" ? "YOLOv8 ONNX" : "demo mock CV"}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              loading…
            </Badge>
          )}
          <Sparkles className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
          <Label htmlFor="vision-mock" className="text-[10px]">
            Demo feed
          </Label>
          <Switch id="vision-mock" checked={demoFeed} onCheckedChange={setDemoFeed} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <video ref={videoRef} className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0" autoPlay playsInline muted />
        <canvas ref={displayRef} width={DISP_W} height={DISP_H} className="w-full max-w-full rounded-md border border-zinc-800 bg-black" />
        {!demoFeed ? (
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            {cameraError ? (
              <>
                <VideoOff className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                <span className="text-amber-200/90">{cameraError}</span>
                <Button type="button" size="sm" variant="secondary" className="h-7 text-[10px]" onClick={() => void startCamera()}>
                  Retry camera
                </Button>
              </>
            ) : (
              <>
                <Video className="h-3.5 w-3.5 text-sky-400" aria-hidden />
                <span>{cameraReady ? "Webcam streaming — boxes from live frames." : "Requesting camera access…"}</span>
              </>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Synthetic SAR-style motion + YOLO inference (ONNX when models are in <span className="font-mono">public/models</span>
            , otherwise deterministic mock boxes).
          </p>
        )}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Fused confidence (pre-alert)</p>
          <Progress value={fused * 100} className="h-2" />
          <p className="text-[10px] font-mono mt-1 text-foreground">{(fused * 100).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Recent detections</p>
          <ScrollArea className="h-[100px] text-[10px] font-mono border border-zinc-800/80 rounded-md p-2">
            {dets.map((d) => (
              <div key={d.id} className="border-b border-zinc-800/50 py-1">
                {(d.conf * 100).toFixed(0)}% conf · fused {(d.fused * 100).toFixed(0)}% · {d.confirmed ? "swarm OK" : "pending"} ·{" "}
                {new Date(d.at).toLocaleTimeString()}
              </div>
            ))}
            {!dets.length ? <span className="text-muted-foreground">No boxes yet.</span> : null}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
});
