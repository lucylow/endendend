import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Radio,
  CloudOff,
  Database,
  Zap,
  UserX,
  Shuffle,
  Bell,
  Languages,
} from "lucide-react";
import { useVertexSwarm } from "@/hooks/useVertexSwarm";
import { SwarmOverview } from "@/components/SwarmOverview";
import { SwarmRolePanel } from "@/components/SwarmRolePanel";
import { SwarmPeerGraph } from "@/components/SwarmPeerGraph";
import { SwarmNodePanel } from "@/components/SwarmNodePanel";
import { SwarmRecoveryPanel } from "@/components/SwarmRecoveryPanel";
import { SwarmTaskPanel } from "@/components/SwarmTaskPanel";
import { useBlackoutMode } from "@/hooks/useBlackoutMode";
import { useSimulationMode } from "@/hooks/useSimulationMode";
import { Slider } from "@/components/ui/slider";
import { VertexNodeCard } from "@/components/VertexNodeCard";
import { VertexMissionPanel } from "@/components/VertexMissionPanel";
import { VertexConnectivityPanel } from "@/components/VertexConnectivityPanel";
import { VertexTaskBoard } from "@/components/VertexTaskBoard";
import { Vertex2MeshStatus } from "@/components/Vertex2MeshStatus";
import { Vertex2NetworkControls } from "@/components/Vertex2NetworkControls";
import { Vertex2ConnectivityGraph } from "@/components/Vertex2ConnectivityGraph";
import { Vertex2ConsensusPanel } from "@/components/Vertex2ConsensusPanel";
import { Vertex2RecoveryPanel } from "@/components/Vertex2RecoveryPanel";
import { Vertex2ReplayPanel } from "@/components/Vertex2ReplayPanel";
import { MeshSurvivalPanel } from "@/components/MeshSurvivalPanel";
import { Vertex2PeerCard } from "@/components/Vertex2PeerCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScenarioSwitcher, type ScenarioKey } from "@/components/scenario/ScenarioSwitcher";
import { ScenarioMainPanel } from "@/components/scenario/ScenarioMainPanel";
import { MissionFleetPanel } from "@/components/blackout/MissionFleetPanel";
import {
  BlackoutSafetyPanel,
  BlackoutRecoveryPanel,
  BlackoutTaskAllocationPanel,
  BlackoutSettlementPanel,
} from "@/components/blackout/BlackoutOpsPanels";
import { useTashiEnvelope } from "@/hooks/useTashiSelectors";
import { chrome, spacing, typography } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import { useStreamingMetric } from "@/hooks/useStreamingMetric";
import { useSwarmMetricsFromView } from "@/hooks/useSwarmMetricsFromView";
import { useDemoMissionPlayback } from "@/hooks/useDemoMissionPlayback";
import { usePersistedEnvelope } from "@/hooks/usePersistedEnvelope";
import { useMissionPushNotifications, requestNotificationPermission } from "@/hooks/useMissionPushNotifications";
import { useBlackoutKeyboardShortcuts } from "@/hooks/useBlackoutKeyboardShortcuts";
import { BlackoutStreamingCharts } from "@/components/blackout/BlackoutStreamingCharts";
import { TelemetryLiveTable } from "@/components/blackout/TelemetryLiveTable";
import { MissionPhaseTimeline } from "@/components/blackout/MissionPhaseTimeline";
import { HardwareBridgePanel } from "@/components/blackout/HardwareBridgePanel";
import { YoloVisionPanel } from "@/components/blackout/YoloVisionPanel";
import { DevFailureInjectionPanel } from "@/components/blackout/DevFailureInjectionPanel";
import { BlackoutMobileCompanion } from "@/components/blackout/BlackoutMobileCompanion";
import { ConnectionStateBanner } from "@/components/ConnectionStateBanner";
import { BlackoutTour, shouldAutoStartBlackoutTour } from "@/components/blackout/BlackoutTour";
import { useTheme } from "next-themes";
import { t, type BlackoutLang } from "@/lib/i18n/blackoutDashboard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SharedWorldMapPanel = lazy(() =>
  import("@/components/SharedWorldMapPanel").then((m) => ({ default: m.SharedWorldMapPanel })),
);
const VertexReplayPanel = lazy(() =>
  import("@/components/VertexReplayPanel").then((m) => ({ default: m.VertexReplayPanel })),
);
const SwarmEventFeed = lazy(() => import("@/components/SwarmEventFeed").then((m) => ({ default: m.SwarmEventFeed })));
const SwarmEventTimeline = lazy(() =>
  import("@/components/SwarmEventTimeline").then((m) => ({ default: m.SwarmEventTimeline })),
);

function PanelFallback({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center text-sm text-muted-foreground">
      Loading {label}…
    </div>
  );
}

export function VertexSwarmDashboard() {
  const {
    view,
    isRunning,
    start,
    pause,
    stepOnce,
    reset,
    scenario,
    setScenario,
    seed,
    setSeed,
    agentCount,
    setAgentCount,
    useMockFallback,
    setUseMockFallback,
    lastError,
    eventLog,
    triggerBlackout,
    recoverBlackout,
    forceDropout,
    injectTarget,
    forceRoleHandoff,
    meshInjectPacketLoss,
    meshInjectLatency,
    meshTogglePartition,
    meshResetStress,
    snapshotFoxMap,
    replayFoxMapHistory,
    stampFoxMapCell,
    recoverFoxMapNode,
    runtimeEvents,
    recoverDrone,
    emergencyHardwareStop,
    meshSetStressPreset,
  } = useVertexSwarm();
  const { simSpeed, setSimSpeed } = useSimulationMode();
  const blackout = useBlackoutMode();
  const envelope = useTashiEnvelope();
  const mapAnchor = useRef<HTMLDivElement | null>(null);
  const missionStartRef = useRef<number | null>(null);
  const { theme, setTheme } = useTheme();
  const [lang, setLang] = useState<BlackoutLang>("en");
  const [demoMode, setDemoMode] = useState(false);
  const [demoSpeed, setDemoSpeed] = useState(1);
  const [tourOpen, setTourOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [netOnline, setNetOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const metricsWs = import.meta.env.VITE_SWARM_METRICS_WS as string | undefined;
  const { points: metricPoints, pushPoint, clear: clearMetrics } = useStreamingMetric({
    wsUrl: metricsWs || null,
    enabled: Boolean(metricsWs),
  });

  useSwarmMetricsFromView(view, pushPoint, { enabled: !demoMode && !metricsWs });
  useDemoMissionPlayback(pushPoint, { active: demoMode && !metricsWs, speed: demoSpeed, loop: true });
  usePersistedEnvelope(envelope);
  useMissionPushNotifications(envelope?.alerts ?? []);

  useBlackoutKeyboardShortcuts(
    {
      onKillSelected: () => forceDropout("agent-scout-a"),
      onOpenSettlement: () => document.getElementById("blackout-settlement-panel")?.scrollIntoView({ behavior: "smooth" }),
      onResetChain: () => meshResetStress(),
    },
    true,
  );

  useEffect(() => {
    if (view && missionStartRef.current == null) missionStartRef.current = view.nowMs;
  }, [view]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const fn = () => setIsDesktop(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    const up = () => setNetOnline(true);
    const down = () => setNetOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  useEffect(() => {
    if (isDesktop && shouldAutoStartBlackoutTour()) setTourOpen(true);
  }, [isDesktop]);

  useEffect(() => {
    clearMetrics();
  }, [demoMode, clearMetrics]);

  const onlineCount = envelope?.nodes.filter((n) => n.health === "online" || n.health === "syncing").length ?? 0;
  const meshBadgeVariant: "default" | "secondary" | "destructive" =
    envelope == null
      ? "secondary"
      : envelope.alerts.some((a) => a.severity === "critical")
        ? "destructive"
        : onlineCount > 2
          ? "default"
          : "secondary";

  const flatForScenario = envelope ?? {
    missionId: "—",
    scenario: scenario as string,
    phase: "init",
    mapSummary: { exploredCells: 0, coveragePercent: 0, targets: [] },
    nodes: [],
    alerts: [],
    recovery: { state: "recovered", checkpointLag: 0, mapLagPct: 0 },
    source: "local_engine",
  };

  const scrollToMap = () => {
    mapAnchor.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={cn(chrome.page, spacing.panelPadding, typography.sans)}>
      <header className={cn(chrome.topBar, "-mx-4 md:-mx-6 px-4 md:px-6 py-4 mb-6 space-y-4")}>
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-sky-400/90">BLACKOUT</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("title", lang)}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("subtitle", lang)}</p>
            <p className="text-[10px] text-zinc-500 font-mono">{t("shortcuts", lang)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={meshBadgeVariant} className="font-mono text-[10px] gap-1">
              <Radio className="w-3 h-3" aria-hidden />
              {onlineCount} online
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono">
              {blackout.label}
            </Badge>
            <Select value={lang} onValueChange={(v) => setLang(v as BlackoutLang)}>
              <SelectTrigger className="h-11 w-[100px] text-xs" aria-label="Language">
                <Languages className="w-3.5 h-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">EN</SelectItem>
                <SelectItem value="es">ES</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 text-xs"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "light" ? t("themeDark", lang) : t("themeLight", lang)}
            </Button>
            <Button type="button" size="sm" variant="outline" className="min-h-11 gap-1 text-xs" onClick={() => void requestNotificationPermission()}>
              <Bell className="w-3.5 h-3.5" aria-hidden />
              {t("notify", lang)}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="min-h-11 text-xs" onClick={() => setTourOpen(true)}>
              {t("tour", lang)}
            </Button>
            <Button
              size="sm"
              variant={demoMode ? "secondary" : "outline"}
              className="min-h-11 text-xs font-mono"
              onClick={() => setDemoMode((d) => !d)}
            >
              {demoMode ? t("demo", lang) : t("live", lang)}
            </Button>
            {demoMode ? (
              <Select value={String(demoSpeed)} onValueChange={(v) => setDemoSpeed(Number(v))}>
                <SelectTrigger className="h-11 w-[88px] text-xs" aria-label="Demo speed">
                  <SelectValue placeholder="1×" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1×</SelectItem>
                  <SelectItem value="2">2×</SelectItem>
                  <SelectItem value="4">4×</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            <Button size="sm" variant={isRunning ? "secondary" : "default"} className="min-h-11" onClick={() => (isRunning ? pause() : start())} aria-label={isRunning ? "Pause simulation" : "Run simulation"}>
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isRunning ? t("pause", lang) : t("run", lang)}
            </Button>
            <Button size="sm" variant="outline" className="min-h-11" onClick={() => void stepOnce()} aria-label="Step simulation once">
              <StepForward className="w-3.5 h-3.5" /> Step
            </Button>
            <Button size="sm" variant="ghost" className="min-h-11" onClick={() => void reset()} aria-label="Reset simulation">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <ScenarioSwitcher
          activeScenario={scenario}
          onChange={(s: ScenarioKey) => setScenario(s as MissionScenarioKind)}
        />
      </header>

      <BlackoutTour run={tourOpen} onClose={() => setTourOpen(false)} />
      <ConnectionStateBanner lastUpdateMs={view?.nowMs ?? null} />

      <div className="md:hidden mb-4">
        <BlackoutMobileCompanion view={view} envelope={flatForScenario} offline={!netOnline} />
      </div>

      {lastError ? (
        <p className="text-sm text-destructive border border-destructive/30 rounded-lg px-3 py-2 mb-4" role="alert">
          {lastError}
        </p>
      ) : null}

      <BlackoutSettlementPanel envelope={flatForScenario} />

      <div className="flex flex-wrap items-center gap-3 md:gap-4 p-4 rounded-xl border border-zinc-800/90 bg-zinc-900/60 mb-6">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Seed</Label>
          <input
            type="number"
            className="h-11 min-w-[5rem] rounded-md border border-input bg-background px-2 text-xs font-mono"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            aria-label="Simulation seed"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Agents (5–12)</Label>
          <input
            type="number"
            min={5}
            max={12}
            className="h-11 w-16 rounded-md border border-input bg-background px-2 text-xs font-mono"
            value={agentCount}
            onChange={(e) => setAgentCount(Number(e.target.value) || 5)}
            aria-label="Agent count"
          />
        </div>
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
          <Label className="text-xs">Mock fallback</Label>
          <Switch checked={useMockFallback} onCheckedChange={setUseMockFallback} />
        </div>
        <div className="flex flex-col gap-1 min-w-[180px] flex-1">
          <Label className="text-xs text-muted-foreground">Sim speed ×{simSpeed.toFixed(2)}</Label>
          <Slider min={0.25} max={4} step={0.25} value={[simSpeed]} onValueChange={(v) => setSimSpeed(v[0] ?? 1)} className="w-full" />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Radio className="w-3.5 h-3.5 text-primary" aria-hidden />
          <span className="text-muted-foreground">Mesh</span>
          <Badge variant={blackout.blackoutActive ? "destructive" : "secondary"} className="text-[10px]">
            {blackout.label}
          </Badge>
          {blackout.blackoutActive ? <CloudOff className="w-3.5 h-3.5 text-destructive" aria-hidden /> : null}
        </div>
        <Button size="sm" variant="outline" className="h-11 text-xs" onClick={() => void triggerBlackout()} aria-label="Trigger mesh blackout">
          <Zap className="w-3.5 h-3.5" /> Blackout
        </Button>
        <Button size="sm" variant="ghost" className="h-11 text-xs" onClick={() => void recoverBlackout()} aria-label="Recover mesh">
          Recover mesh
        </Button>
        <Button size="sm" variant="ghost" className="h-11 text-xs" onClick={() => forceDropout("agent-relay-b")} aria-label="Force relay dropout">
          <UserX className="w-3.5 h-3.5" /> Drop relay
        </Button>
        <Button size="sm" variant="secondary" className="h-11 text-xs" onClick={() => void injectTarget("agent-scout-a")} aria-label="Inject target">
          Inject target
        </Button>
        <Button size="sm" variant="outline" className="h-11 text-xs" onClick={() => void forceRoleHandoff("agent-scout-a")} aria-label="Force role handoff">
          <Shuffle className="w-3.5 h-3.5" /> Role handoff
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6">
        <section className="xl:col-span-7 space-y-4" aria-labelledby="scenario-workspace-heading">
          <h2 id="scenario-workspace-heading" className="sr-only">
            Scenario workspace
          </h2>
          <ScenarioMainPanel scenario={scenario} envelope={flatForScenario} />
          <SwarmOverview view={view} />
          <div ref={mapAnchor}>
            <Suspense fallback={<PanelFallback label="world map" />}>
              <SharedWorldMapPanel
                view={view}
                scenario={scenario}
                show3D={isDesktop}
                onSnapshot={() => snapshotFoxMap()}
                onReplay={() => replayFoxMapHistory()}
                onStamp={() => stampFoxMapCell(0, 0)}
                onRecoverSample={() => void recoverFoxMapNode("agent-relay-b")}
              />
            </Suspense>
          </div>
        </section>

        <aside className="xl:col-span-5 space-y-4" aria-label="Fleet safety and allocation">
          <MissionFleetPanel
            nodes={view?.nodes ?? []}
            telemetry={view?.telemetry ?? []}
            autonomy={view?.autonomy ?? []}
            nowMs={view?.nowMs ?? Date.now()}
          />
          <BlackoutSafetyPanel envelope={flatForScenario} onShowOnMap={scrollToMap} />
          <BlackoutRecoveryPanel envelope={flatForScenario} />
          <BlackoutTaskAllocationPanel view={view} />
        </aside>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <div className="xl:col-span-2">
          <BlackoutStreamingCharts points={metricPoints} />
        </div>
        <TelemetryLiveTable view={view} />
      </div>

      {view ? (
        <div className="mb-6">
          <MissionPhaseTimeline
            phase={view.phase}
            runtimeEvents={runtimeEvents}
            missionStartMs={missionStartRef.current ?? view.nowMs - 1}
            nowMs={view.nowMs}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <HardwareBridgePanel view={view} onEmergencyStop={() => void emergencyHardwareStop()} />
        <YoloVisionPanel />
      </div>

      <Card variant="mission" className="mb-6 border-zinc-800">
        <CardHeader className="py-3 space-y-1">
          <CardTitle className="text-sm">Mesh resilience (Vertex 2.0)</CardTitle>
          <CardDescription className="text-[11px] leading-relaxed">
            Lattice discovery, relay paths, Proof-of-Coordination, partition buffers, and Arc checkpoints on the mesh ledger.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Vertex2MeshStatus mesh={view?.meshV2 ?? null} />
          <Vertex2NetworkControls
            onInjectLoss={() => meshInjectPacketLoss(0.12)}
            onInjectLatency={() => meshInjectLatency(180)}
            onPartitionOn={() => meshTogglePartition(true)}
            onPartitionOff={() => meshTogglePartition(false)}
            onResetStress={() => meshResetStress()}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-foreground mb-2">Connectivity graph</h3>
              <Vertex2ConnectivityGraph graph={view?.meshV2?.graph ?? null} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground mb-2">Consensus health</h3>
              <Vertex2ConsensusPanel mesh={view?.meshV2 ?? null} />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-foreground mb-2">Recovery & checkpoints</h3>
              <Vertex2RecoveryPanel mesh={view?.meshV2 ?? null} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground mb-2">Replay narrative</h3>
              <Vertex2ReplayPanel entries={view?.meshV2?.replay ?? []} />
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground mb-2">Peer registry</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
              {(view?.meshV2?.peers ?? []).map((p) => (
                <Vertex2PeerCard key={p.peerId} peer={p} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <MeshSurvivalPanel mesh={view?.meshSurvival ?? null} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <VertexMissionPanel view={view} />
        <VertexConnectivityPanel view={view} />
        <VertexTaskBoard view={view} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SwarmPeerGraph />
        <SwarmNodePanel />
        <SwarmRecoveryPanel />
        <SwarmTaskPanel />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <SwarmRolePanel view={view} />
      </div>

      {(view?.discovery?.length ?? 0) > 0 && (
        <Card variant="node" className="mb-6 border-zinc-800">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Target discovery pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[140px] text-xs font-mono">
              {view!.discovery.map((d) => (
                <div key={d.candidateId} className="border-b border-border/25 py-1">
                  <span className="text-foreground">{d.candidateId}</span> · {(d.mergedConfidence01 * 100).toFixed(0)}% · {d.status} ·{" "}
                  {d.trustExplanation.join(" · ")}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <section className="mb-6" aria-label="Extended agent grid">
        <h2 className="text-sm font-semibold mb-2 text-foreground">All agents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {(view?.nodes ?? []).map((n) => (
            <VertexNodeCard
              key={n.nodeId}
              node={n}
              telemetry={view?.telemetry.find((t) => t.nodeId === n.nodeId)}
              autonomy={view?.autonomy.find((a) => a.nodeId === n.nodeId)}
            />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Suspense fallback={<PanelFallback label="replay" />}>
          <VertexReplayPanel view={view} />
        </Suspense>
        <Suspense fallback={<PanelFallback label="event feed" />}>
          <SwarmEventFeed view={view} />
        </Suspense>
      </div>

      <Suspense fallback={<PanelFallback label="timeline" />}>
        <SwarmEventTimeline />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <Card variant="node" className="border-zinc-800">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Telemetry stream</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[200px] px-4 pb-3 font-mono text-[10px]">
              {(view?.telemetry ?? []).map((t) => (
                <div key={`${t.nodeId}-${t.sequence}`} className="text-muted-foreground border-b border-border/20 py-1">
                  {t.nodeId} seq={t.sequence} bat={(t.battery01 * 100).toFixed(0)}% link={(t.link01 * 100).toFixed(0)}%
                  {t.duplicate ? " dup" : ""}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card variant="node" className="mt-6 border-zinc-800">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Event log</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[120px] text-xs font-mono text-muted-foreground" aria-live="polite" aria-relevant="additions text">
            {eventLog.map((e, i) => (
              <div key={i}>
                {new Date(e.at).toLocaleTimeString()} — {e.message}
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {import.meta.env.DEV ? (
        <div className="mt-6">
          <DevFailureInjectionPanel
            nodes={view?.nodes ?? []}
            onKill={(id) => forceDropout(id)}
            onRestore={(id) => void recoverDrone(id)}
            onLoss={(_id: string) => {
              meshInjectPacketLoss(0.5);
            }}
            onDelay={(_id: string) => {
              meshInjectLatency(200);
            }}
            onKillAllRelays={() => {
              (view?.nodes ?? []).filter((n) => n.role === "relay").forEach((n) => forceDropout(n.nodeId));
            }}
            onBurstLoss={() => meshInjectPacketLoss(0.35)}
            onTunnelPreset={() => meshSetStressPreset("tunnel_connectivity")}
            onPartitionPreset={() => meshTogglePartition(true)}
          />
        </div>
      ) : null}
    </div>
  );
}
