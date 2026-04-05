import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Radio, Wifi, WifiOff, Zap, Signal, Activity, AlertTriangle,
  Settings2, BarChart3, ArrowDownUp, Waves, Eye,
} from "lucide-react";
import {
  type EmulatorConfig,
  type EmulatorMetrics,
  type LinkQuality,
  DEFAULT_EMULATOR_CONFIG,
  GilbertElliottManager,
  computeAllLinkQualities,
  evaluatePacketDelivery,
  generateDegradationZones,
  createEmulatorMetrics,
} from "@/store/networkEmulator";
import { useP2PStore } from "@/store/p2pStore";
import type { LucideIcon } from "lucide-react";

const PRESET_SCENARIOS: { name: string; icon: LucideIcon; config: EmulatorConfig }[] = [
  {
    name: "Gradual Loss",
    icon: Signal,
    config: { ...DEFAULT_EMULATOR_CONFIG, lossModel: "depth_based", baseLoss: 0.02, burstEnabled: false },
  },
  {
    name: "Bursty Fading",
    icon: Waves,
    config: { ...DEFAULT_EMULATOR_CONFIG, baseLoss: 0.05, burstEnabled: true, burstParams: { pGoodToBad: 0.2, pBadToGood: 0.15, lossInBad: 0.9 } },
  },
  {
    name: "Full Partition",
    icon: WifiOff,
    config: { ...DEFAULT_EMULATOR_CONFIG, baseLoss: 0.4, maxRange: 8, asymmetryThreshold: 10, burstEnabled: true, burstParams: { pGoodToBad: 0.3, pBadToGood: 0.1, lossInBad: 0.95 } },
  },
  {
    name: "Relay Failure Cascade",
    icon: AlertTriangle,
    config: { ...DEFAULT_EMULATOR_CONFIG, baseLoss: 0.15, asymmetryThreshold: 12, maxRange: 15, burstEnabled: true, burstParams: { pGoodToBad: 0.25, pBadToGood: 0.2, lossInBad: 0.85 } },
  },
];

const statusColors: Record<string, string> = {
  excellent: "bg-success", good: "bg-success/70", degraded: "bg-accent",
  critical: "bg-accent", blackout: "bg-destructive",
};
const statusTextColors: Record<string, string> = {
  excellent: "text-success", good: "text-success/80", degraded: "text-accent",
  critical: "text-accent", blackout: "text-destructive",
};

export default function BlackoutEnvironmentPanel() {
  const peers = useP2PStore((s) => s.peers);
  const p2pRunning = useP2PStore((s) => s.p2pRunning);

  const [config, setConfig] = useState<EmulatorConfig>(DEFAULT_EMULATOR_CONFIG);
  const [metrics, setMetrics] = useState<EmulatorMetrics>(createEmulatorMetrics());
  const [burstManager] = useState(() => new GilbertElliottManager());
  const [packetLog, setPacketLog] = useState<{ time: number; src: string; dst: string; delivered: boolean; reason: string; latency: number }[]>([]);

  // Compute link qualities from live peers
  const linkQualities = useMemo(() => {
    if (Object.keys(peers).length === 0) return [];
    return computeAllLinkQualities(peers, config);
  }, [peers, config]);

  // Degradation zones table
  const zones = useMemo(() => generateDegradationZones(config), [config]);

  // Simulate packet transmissions when P2P is running
  useEffect(() => {
    if (!p2pRunning || linkQualities.length === 0) return;
    const iv = setInterval(() => {
      // Pick a random link and simulate a packet
      const link = { ...linkQualities[Math.floor(Math.random() * linkQualities.length)] };
      const result = evaluatePacketDelivery(link, burstManager, config);

      setMetrics((prev) => {
        const total = prev.totalPackets + 1;
        const dropped = prev.droppedPackets + (result.delivered ? 0 : 1);
        const delivered = prev.deliveredPackets + (result.delivered ? 1 : 0);
        const avgLat = result.delivered
          ? (prev.avgLatency * prev.deliveredPackets + result.latencyMs) / delivered
          : prev.avgLatency;
        return {
          totalPackets: total,
          droppedPackets: dropped,
          deliveredPackets: delivered,
          avgLatency: avgLat,
          burstDrops: prev.burstDrops + (result.reason === "burst_drop" ? 1 : 0),
          asymmetryBlocks: prev.asymmetryBlocks + (result.reason === "asymmetry_block" ? 1 : 0),
          rangeBlocks: prev.rangeBlocks + (result.reason === "out_of_range" ? 1 : 0),
          matrixBlocks: (prev.matrixBlocks ?? 0) + (result.reason === "matrix_block" ? 1 : 0),
          deliveryRatio: delivered / total,
          linkQualities,
        };
      });

      setPacketLog((prev) => [
        { time: Date.now(), src: link.sourceId, dst: link.destId, delivered: result.delivered, reason: result.reason, latency: result.latencyMs },
        ...prev,
      ].slice(0, 80));
    }, 600);
    return () => clearInterval(iv);
  }, [p2pRunning, linkQualities, burstManager, config]);

  const peerNames = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(peers).forEach((p) => { map[p.nodeId] = p.name; });
    return map;
  }, [peers]);

  const updateConfig = (patch: Partial<EmulatorConfig>) => setConfig((c) => ({ ...c, ...patch }));
  const updateBurst = (patch: Partial<EmulatorConfig["burstParams"]>) =>
    setConfig((c) => ({ ...c, burstParams: { ...c.burstParams, ...patch } }));

  return (
    <div className="space-y-4">
      {/* Header metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { label: "Packets", value: metrics.totalPackets, icon: Radio },
          { label: "Delivered", value: metrics.deliveredPackets, icon: Wifi },
          { label: "Dropped", value: metrics.droppedPackets, icon: WifiOff },
          { label: "Delivery %", value: `${(metrics.deliveryRatio * 100).toFixed(1)}%`, icon: BarChart3 },
          { label: "Avg Latency", value: `${metrics.avgLatency.toFixed(0)}ms`, icon: Zap },
          { label: "Burst Drops", value: metrics.burstDrops, icon: Waves },
          { label: "Asymmetry", value: metrics.asymmetryBlocks, icon: ArrowDownUp },
          { label: "Range Blocks", value: metrics.rangeBlocks, icon: Signal },
          { label: "Matrix Cut", value: metrics.matrixBlocks, icon: WifiOff },
        ].map((m) => (
          <Card key={m.label} className="bg-card/50 border-border">
            <CardContent className="p-2">
              <m.icon className="w-3 h-3 text-muted-foreground mb-1" />
              <div className="font-mono text-sm font-bold text-primary">{m.value}</div>
              <div className="text-[9px] text-muted-foreground">{m.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="degradation" className="w-full">
        <TabsList className="bg-card/50 border border-border">
          <TabsTrigger value="degradation">Degradation Zones</TabsTrigger>
          <TabsTrigger value="links">Link Quality</TabsTrigger>
          <TabsTrigger value="config">Emulator Config</TabsTrigger>
          <TabsTrigger value="packets">Packet Log</TabsTrigger>
        </TabsList>

        {/* DEGRADATION ZONES */}
        <TabsContent value="degradation" className="mt-4">
          <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
            <div className="grid grid-cols-4 gap-0 text-[10px] font-mono font-semibold text-muted-foreground border-b border-border px-5 py-3 tracking-wider">
              <span>DEPTH</span><span>PACKET LOSS</span><span>LATENCY</span><span>SIGNAL</span>
            </div>
            {zones.map((row, i) => (
              <motion.div key={row.depth} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="grid grid-cols-4 gap-0 text-xs font-mono px-5 py-3 border-b border-border/30 last:border-0 items-center hover:bg-muted/20 transition-colors"
              >
                <span className="text-foreground font-medium">{row.depth}</span>
                <span className={row.lossValue > 0.5 ? "text-accent font-semibold" : "text-foreground"}>{row.loss}</span>
                <span className={row.lossValue > 0.5 ? "text-accent font-semibold" : "text-foreground"}>{row.latency}</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${(1 - row.lossValue) * 100}%` }}
                      transition={{ delay: i * 0.06 + 0.2, duration: 0.5 }}
                      className={`h-full rounded-full ${statusColors[row.status]}`}
                    />
                  </div>
                  <span className={`text-[10px] uppercase font-semibold ${statusTextColors[row.status]}`}>{row.status}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Gilbert-Elliott state visualization */}
          {config.burstEnabled && (
            <div className="mt-4 rounded-xl border border-border bg-card/50 p-4">
              <h4 className="font-mono text-xs text-muted-foreground tracking-wider mb-3 flex items-center gap-2">
                <Waves className="w-4 h-4" /> GILBERT-ELLIOTT BURST MODEL
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-success/10 border border-success/20 p-3 text-center">
                  <div className="text-success font-mono text-lg font-bold">GOOD</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Loss: {(config.baseLoss * 100).toFixed(0)}% • P(→bad): {(config.burstParams.pGoodToBad * 100).toFixed(0)}%
                  </div>
                  <div className="mt-2 text-xs text-success/70">→ bad state</div>
                </div>
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-center">
                  <div className="text-destructive font-mono text-lg font-bold">BAD</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Loss: {(config.burstParams.lossInBad * 100).toFixed(0)}% • P(→good): {(config.burstParams.pBadToGood * 100).toFixed(0)}%
                  </div>
                  <div className="mt-2 text-xs text-destructive/70">→ good state</div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* LINK QUALITY */}
        <TabsContent value="links" className="mt-4">
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <h4 className="font-mono text-xs text-muted-foreground tracking-wider mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" /> PAIRWISE LINK QUALITY ({linkQualities.length} links)
            </h4>
            <ScrollArea className="h-72">
              {linkQualities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Start P2P to see link qualities.</p>
              ) : (
                <div className="space-y-1">
                  {linkQualities.map((lq) => (
                    <div key={`${lq.sourceId}-${lq.destId}`}
                      className={`flex items-center justify-between text-[10px] font-mono rounded-lg px-3 py-1.5 ${
                        lq.isBlocked || lq.isOutOfRange ? "bg-destructive/10 text-destructive" :
                        lq.lossProbability > 0.5 ? "bg-accent/10 text-accent" :
                        "bg-muted/20 text-foreground"
                      }`}>
                      <span className="flex items-center gap-1">
                        {peerNames[lq.sourceId] || lq.sourceId} ↔ {peerNames[lq.destId] || lq.destId}
                      </span>
                      <div className="flex items-center gap-3">
                        <span>dist: {lq.distance.toFixed(1)}</span>
                        <span>loss: {(lq.lossProbability * 100).toFixed(0)}%</span>
                        <span>lat: {lq.latencyMs.toFixed(0)}ms</span>
                        {lq.isBlocked && <span className="text-destructive">⛔ ASYM</span>}
                        {lq.isOutOfRange && <span className="text-destructive">📡 OOR</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </TabsContent>

        {/* CONFIG */}
        <TabsContent value="config" className="mt-4">
          <div className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
            <h4 className="font-mono text-xs text-muted-foreground tracking-wider flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> EMULATOR CONFIGURATION
            </h4>

            {/* Preset scenarios */}
            <div>
              <label className="text-[10px] text-muted-foreground font-mono block mb-1">PRESET SCENARIOS</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_SCENARIOS.map((s) => (
                  <Button key={s.name} size="sm" variant="outline"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => { setConfig(s.config); burstManager.reset(); setMetrics(createEmulatorMetrics()); setPacketLog([]); }}>
                    <s.icon className="w-3 h-3" />
                    {s.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Loss model */}
            <div>
              <label className="text-[10px] text-muted-foreground font-mono block mb-1">LOSS MODEL</label>
              <div className="flex gap-2">
                {(["depth_based", "distance", "constant"] as const).map((m) => (
                  <Button key={m} size="sm" variant={config.lossModel === m ? "default" : "outline"}
                    className="h-7 text-xs capitalize" onClick={() => updateConfig({ lossModel: m })}>
                    {m.replace("_", " ")}
                  </Button>
                ))}
              </div>
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-2 gap-4">
              <ConfigSlider label="Base Loss" value={config.baseLoss} min={0} max={0.5} step={0.01}
                display={`${(config.baseLoss * 100).toFixed(0)}%`}
                onChange={(v) => updateConfig({ baseLoss: v })} />
              <ConfigSlider label="Asymmetry Threshold" value={config.asymmetryThreshold} min={5} max={50} step={1}
                display={`${config.asymmetryThreshold}m`}
                onChange={(v) => updateConfig({ asymmetryThreshold: v })} />
              <ConfigSlider label="Latency/Meter" value={config.latencyPerMeter} min={0.5} max={10} step={0.5}
                display={`${config.latencyPerMeter}ms`}
                onChange={(v) => updateConfig({ latencyPerMeter: v })} />
              <ConfigSlider label="Max Range" value={config.maxRange} min={10} max={50} step={1}
                display={`${config.maxRange}u`}
                onChange={(v) => updateConfig({ maxRange: v })} />
              <ConfigSlider label="Tunnel Depth Max" value={config.tunnelDepthMax} min={50} max={200} step={10}
                display={`${config.tunnelDepthMax}m`}
                onChange={(v) => updateConfig({ tunnelDepthMax: v })} />
            </div>

            {/* Burst params */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] text-muted-foreground font-mono">BURST MODEL (GILBERT-ELLIOTT)</label>
                <Button size="sm" variant={config.burstEnabled ? "default" : "outline"}
                  className="h-6 text-[10px]" onClick={() => updateConfig({ burstEnabled: !config.burstEnabled })}>
                  {config.burstEnabled ? "Enabled" : "Disabled"}
                </Button>
              </div>
              {config.burstEnabled && (
                <div className="grid grid-cols-3 gap-3">
                  <ConfigSlider label="P(Good→Bad)" value={config.burstParams.pGoodToBad} min={0} max={0.5} step={0.01}
                    display={`${(config.burstParams.pGoodToBad * 100).toFixed(0)}%`}
                    onChange={(v) => updateBurst({ pGoodToBad: v })} />
                  <ConfigSlider label="P(Bad→Good)" value={config.burstParams.pBadToGood} min={0} max={0.8} step={0.01}
                    display={`${(config.burstParams.pBadToGood * 100).toFixed(0)}%`}
                    onChange={(v) => updateBurst({ pBadToGood: v })} />
                  <ConfigSlider label="Loss in Bad" value={config.burstParams.lossInBad} min={0.3} max={1} step={0.05}
                    display={`${(config.burstParams.lossInBad * 100).toFixed(0)}%`}
                    onChange={(v) => updateBurst({ lossInBad: v })} />
                </div>
              )}
            </div>

            {/* Reset */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                setConfig(DEFAULT_EMULATOR_CONFIG);
                burstManager.reset();
                setMetrics(createEmulatorMetrics());
                setPacketLog([]);
              }}>
                Reset All
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                setMetrics(createEmulatorMetrics());
                setPacketLog([]);
                burstManager.reset();
              }}>
                Reset Metrics
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* PACKET LOG */}
        <TabsContent value="packets" className="mt-4">
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <h4 className="font-mono text-xs text-muted-foreground tracking-wider mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4" /> PACKET TRANSMISSION LOG
            </h4>
            <ScrollArea className="h-72">
              {packetLog.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Start P2P simulation to see packets.</p>
              ) : (
                <div className="space-y-0.5">
                  <AnimatePresence>
                    {packetLog.map((p, i) => (
                      <motion.div key={`${p.time}-${i}`}
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                        className={`flex items-center gap-2 text-[10px] font-mono px-2 py-0.5 rounded ${
                          p.delivered ? "text-success/80" : "text-destructive/80"
                        }`}>
                        <span>{p.delivered ? "✓" : "✗"}</span>
                        <span>{peerNames[p.src] || p.src} → {peerNames[p.dst] || p.dst}</span>
                        {p.delivered && <span className="text-muted-foreground">{p.latency.toFixed(0)}ms</span>}
                        <span className="ml-auto text-muted-foreground/50">{p.reason}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Simple range slider component
function ConfigSlider({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number; display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] text-muted-foreground font-mono">{label}</label>
        <span className="text-[10px] font-mono text-primary font-bold">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-muted/50 accent-primary cursor-pointer"
      />
    </div>
  );
}
