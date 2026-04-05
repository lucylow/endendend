import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Eye, Radar, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useSwarmStore } from "@/store/swarmStore";
import {
  ProductionYOLODetector,
  ThermalVisionFusion,
  StakeWeightedTriage,
  useVictimCameras,
  MultiCameraFeed,
  AttractionFieldScene,
  LiveExtractionPanel,
  VictimPriorityHeatmap,
  type VictimPriority,
} from "@/modules/victim-detection";

function ROS2StatusBar({ connected }: { connected: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: connected ? "#22c55e" : "#eab308" }} />
        <span className="font-medium text-foreground">ROS2 bridge</span>
        <span className="text-muted-foreground">{connected ? "/camera + /thermal aligned" : "simulated topics"}</span>
      </div>
      <Badge variant="outline" className="font-mono text-[10px]">
        PX4 SITL · WebRTC
      </Badge>
    </div>
  );
}

export default function VictimDetectionPage() {
  const agents = useSwarmStore((s) => s.agents);
  const startSimulation = useSwarmStore((s) => s.startSimulation);

  const [detector, setDetector] = useState<ProductionYOLODetector | null>(null);
  const [live, setLive] = useState(true);
  const [showThermal, setShowThermal] = useState(true);
  const [conf, setConf] = useState(0.55);
  const [priorities, setPriorities] = useState<VictimPriority[]>([]);
  const [ros2Connected, setRos2Connected] = useState(false);

  const fusion = useMemo(() => new ThermalVisionFusion(), []);
  const triage = useMemo(() => new StakeWeightedTriage(), []);

  useEffect(() => {
    const d = new ProductionYOLODetector();
    void d.init(`${import.meta.env.BASE_URL}models/yolov8n.onnx`).then(() => setDetector(d));
    return () => {
      d.dispose();
    };
  }, []);

  useEffect(() => {
    startSimulation();
  }, [startSimulation]);

  const { feeds, frameTick, canvasesRef, attachWebRtc, videoRef } = useVictimCameras(detector, {
    running: live && !!detector,
    confThreshold: conf,
  });

  const worldHint = useMemo(() => {
    const a = agents[0];
    return { x: a?.position.x ?? 0, y: a?.position.y ?? 0, z: a?.position.z ?? 0 };
  }, [agents]);

  const fusedVictims = useMemo(() => {
    const dets = feeds.flatMap((f) => f.detections.map((d) => ({ ...d, id: `${f.id}_${d.id}` })));
    const thermal = ThermalVisionFusion.syntheticThermal(320, 240, frameTick);
    return fusion.fuse(dets, thermal, worldHint);
  }, [feeds, frameTick, fusion, worldHint]);

  const runTriage = useCallback(async () => {
    if (!fusedVictims.length) {
      setPriorities([]);
      return;
    }
    const p = await triage.triageVictims(fusedVictims, agents);
    setPriorities(p);
    setRos2Connected(true);
  }, [fusedVictims, triage, agents]);

  useEffect(() => {
    const t = window.setInterval(() => {
      void runTriage();
    }, 2800);
    return () => clearInterval(t);
  }, [runTriage]);

  const onExtract = useCallback(
    (victimId: string) => {
      const agent = agents.find((a) => a.role === "explorer") ?? agents[0];
      if (agent) {
        useSwarmStore.getState().selectAgent(agent.id);
      }
      if (import.meta.env.DEV) console.debug("[victim-detection] extract", victimId);
    },
    [agents],
  );

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Eye className="h-6 w-6" />
            <span className="text-xs font-mono uppercase tracking-[0.2em]">Victim detection</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">YOLOv8 · thermal fusion · Vertex triage</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Production stack: ONNX Runtime Web when <code className="rounded bg-muted px-1 py-0.5">public/models/yolov8n.onnx</code>{" "}
            is present; otherwise deterministic mock detections for demos. Stake-weighted prioritization calls the live Vertex +
            BFT path.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-1 font-mono text-xs">
            <Cpu className="h-3.5 w-3.5" />
            {detector?.activeBackend === "onnx" ? "ONNX WASM" : "mock CV"}
          </Badge>
          <Button type="button" variant="outline" size="sm" onClick={() => void runTriage()}>
            Run triage now
          </Button>
        </div>
      </motion.div>

      <ROS2StatusBar connected={ros2Connected} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-6 rounded-xl border border-border bg-card/30 p-4">
            <div className="flex items-center gap-2">
              <Switch id="vd-live" checked={live} onCheckedChange={setLive} />
              <Label htmlFor="vd-live">Live inference</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="vd-thermal" checked={showThermal} onCheckedChange={setShowThermal} />
              <Label htmlFor="vd-thermal">Thermal overlay tint</Label>
            </div>
            <div className="flex min-w-[200px] flex-1 flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Confidence {conf.toFixed(2)}</Label>
              <Slider min={0.25} max={0.9} step={0.05} value={[conf]} onValueChange={(v) => setConf(v[0] ?? 0.55)} />
            </div>
          </div>

          <MultiCameraFeed
            feeds={feeds}
            frameTick={frameTick}
            canvasesRef={canvasesRef}
            videoRef={videoRef}
            onAttachWebRtc={attachWebRtc}
            showThermal={showThermal}
          />

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Radar className="h-4 w-4 text-teal-500" />
            <span>{fusedVictims.length} fused tracks · Kalman-smoothed scores</span>
          </div>
        </div>

        <div className="space-y-4">
          <VictimPriorityHeatmap priorities={priorities} />
          <LiveExtractionPanel priorities={priorities} ros2Connected={ros2Connected} onExtract={onExtract} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground">Magnetic attraction field (3D)</h2>
        <AttractionFieldScene victims={fusedVictims} agents={agents} />
      </div>
    </div>
  );
}
