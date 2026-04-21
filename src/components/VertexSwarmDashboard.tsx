import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Play, Pause, StepForward, RotateCcw, Radio, CloudOff, Database, Zap, UserX, Shuffle } from "lucide-react";
import { useVertexSwarm } from "@/hooks/useVertexSwarm";
import { SwarmMap } from "@/components/SwarmMap";
import { SwarmOverview } from "@/components/SwarmOverview";
import { SwarmRolePanel } from "@/components/SwarmRolePanel";
import { SwarmEventFeed } from "@/components/SwarmEventFeed";
import { SwarmPeerGraph } from "@/components/SwarmPeerGraph";
import { SwarmNodePanel } from "@/components/SwarmNodePanel";
import { SwarmRecoveryPanel } from "@/components/SwarmRecoveryPanel";
import { SwarmEventTimeline } from "@/components/SwarmEventTimeline";
import { SwarmTaskPanel } from "@/components/SwarmTaskPanel";
import { useBlackoutMode } from "@/hooks/useBlackoutMode";
import { useSimulationMode } from "@/hooks/useSimulationMode";
import { Slider } from "@/components/ui/slider";
import { VERTEX_SCENARIO_PRESETS } from "@/backend/vertex/scenario-presets";
import { VertexNodeCard } from "@/components/VertexNodeCard";
import { VertexMissionPanel } from "@/components/VertexMissionPanel";
import { VertexConnectivityPanel } from "@/components/VertexConnectivityPanel";
import { VertexTaskBoard } from "@/components/VertexTaskBoard";
import { VertexReplayPanel } from "@/components/VertexReplayPanel";
import { Vertex2MeshStatus } from "@/components/Vertex2MeshStatus";
import { Vertex2NetworkControls } from "@/components/Vertex2NetworkControls";
import { Vertex2ConnectivityGraph } from "@/components/Vertex2ConnectivityGraph";
import { Vertex2ConsensusPanel } from "@/components/Vertex2ConsensusPanel";
import { Vertex2RecoveryPanel } from "@/components/Vertex2RecoveryPanel";
import { Vertex2ReplayPanel } from "@/components/Vertex2ReplayPanel";
import { Vertex2PeerCard } from "@/components/Vertex2PeerCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  } = useVertexSwarm();
  const { simSpeed, setSimSpeed } = useSimulationMode();
  const blackout = useBlackoutMode();

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Vertex 2.0 swarm control</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Peer-to-peer mesh simulation: neighbors, relay paths, frontier map gossip, corroborated targets, and
            distributed task bids—mock-first in the browser with seeded determinism (no live cloud controller required).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={isRunning ? "secondary" : "default"} onClick={() => (isRunning ? pause() : start())}>
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isRunning ? "Pause" : "Run"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void stepOnce()}>
            <StepForward className="w-3.5 h-3.5" /> Step
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void reset()}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-border/60 bg-card/20">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Scenario</Label>
          <Select value={scenario} onValueChange={(v) => setScenario(v as typeof scenario)}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VERTEX_SCENARIO_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Seed</Label>
          <input
            type="number"
            className="h-8 w-20 rounded-md border border-input bg-background px-2 text-xs font-mono"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Agents (≥5)</Label>
          <input
            type="number"
            min={5}
            max={12}
            className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs font-mono"
            value={agentCount}
            onChange={(e) => setAgentCount(Number(e.target.value) || 5)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-muted-foreground" />
          <Label className="text-xs">Mock fallback</Label>
          <Switch checked={useMockFallback} onCheckedChange={setUseMockFallback} />
        </div>
        <div className="flex flex-col gap-1 min-w-[160px]">
          <Label className="text-xs text-muted-foreground">Sim speed ×{simSpeed.toFixed(2)}</Label>
          <Slider min={0.25} max={4} step={0.25} value={[simSpeed]} onValueChange={(v) => setSimSpeed(v[0] ?? 1)} className="w-full" />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Radio className="w-3.5 h-3.5 text-primary" />
          <span className="text-muted-foreground">Mesh</span>
          <Badge variant={blackout.blackoutActive ? "destructive" : "secondary"} className="text-[10px]">
            {blackout.label}
          </Badge>
          {blackout.blackoutActive && <CloudOff className="w-3.5 h-3.5 text-destructive" />}
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void triggerBlackout()}>
          <Zap className="w-3.5 h-3.5" /> Blackout
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => void recoverBlackout()}>
          Recover mesh
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={() => forceDropout("agent-relay-b")}
        >
          <UserX className="w-3.5 h-3.5" /> Drop relay
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 text-xs"
          onClick={() => void injectTarget("agent-scout-a")}
        >
          Inject target
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void forceRoleHandoff("agent-scout-a")}>
          <Shuffle className="w-3.5 h-3.5" /> Role handoff
        </Button>
      </div>

      {lastError && (
        <p className="text-sm text-destructive border border-destructive/30 rounded-lg px-3 py-2">{lastError}</p>
      )}

      <SwarmOverview view={view} />

      <Card className="border-primary/25 bg-gradient-to-br from-card/80 to-card/40">
        <CardHeader className="py-3 space-y-1">
          <CardTitle className="text-sm">Mesh resilience (Vertex 2.0 proof layer)</CardTitle>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Lattice discovery, relay-ranked paths, Proof-of-Coordination votes with loss/latency/jitter, partition buffers,
            and Arc checkpoints — all append-only on the mesh ledger for replay.
          </p>
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
              <h3 className="text-xs font-semibold text-foreground mb-2">Connectivity graph (live)</h3>
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
            <h3 className="text-xs font-semibold text-foreground mb-2">Peer registry (mesh profiles)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
              {(view?.meshV2?.peers ?? []).map((p) => (
                <Vertex2PeerCard key={p.peerId} peer={p} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <VertexMissionPanel view={view} />
        <VertexConnectivityPanel view={view} />
        <VertexTaskBoard view={view} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <SwarmPeerGraph />
        <SwarmNodePanel />
        <SwarmRecoveryPanel />
        <SwarmTaskPanel />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SwarmMap view={view} />
        <SwarmRolePanel view={view} />
      </div>

      {(view?.discovery?.length ?? 0) > 0 && (
        <Card className="border-border/60 bg-card/20">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Target discovery pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[140px] text-xs font-mono">
              {view!.discovery.map((d) => (
                <div key={d.candidateId} className="border-b border-border/25 py-1">
                  <span className="text-foreground">{d.candidateId}</span> · {(d.mergedConfidence01 * 100).toFixed(0)}% ·{" "}
                  {d.status} · {d.trustExplanation.join(" · ")}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-2 text-foreground">Agents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {view?.nodes.map((n) => (
            <VertexNodeCard
              key={n.nodeId}
              node={n}
              telemetry={view.telemetry.find((t) => t.nodeId === n.nodeId)}
              autonomy={view.autonomy.find((a) => a.nodeId === n.nodeId)}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VertexReplayPanel view={view} />
        <SwarmEventFeed view={view} />
      </div>

      <SwarmEventTimeline />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/60 bg-card/30">
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

      <Card className="border-border/60 bg-card/20">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Event log</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[120px] text-xs font-mono text-muted-foreground">
            {eventLog.map((e, i) => (
              <div key={i}>
                {new Date(e.at).toLocaleTimeString()} — {e.message}
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
