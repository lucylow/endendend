import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipForward, RotateCcw, Compass, Crosshair, Layers, CloudOff, Box, Radio, Activity, Cpu } from "lucide-react";
import { useSwarmStore } from "@/store/swarmStore";
import SwarmScene from "@/components/SwarmScene";
import ExplorationGrid from "@/components/ExplorationGrid";
import TargetPanel from "@/components/TargetPanel";
import TaskAllocationPanel from "@/components/TaskAllocationPanel";
import RoleHandoffPanel from "@/components/RoleHandoffPanel";
import EventLog from "@/components/EventLog";
import P2PCoordinationPanel from "@/components/P2PCoordinationPanel";
import BFTConsensusPanel from "@/components/BFTConsensusPanel";
import BlackoutEnvironmentPanel from "@/components/BlackoutEnvironmentPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export default function SimulationPage() {
  const {
    isRunning, startSimulation, pauseSimulation, speed, setSpeed, agents,
    behaviorMode, setBehaviorMode, resetSimulation, explorationProgress, targets, handoffs,
    consensusMetrics,
  } = useSwarmStore();

  const activeCount = agents.filter((a) => a.status === "active").length;
  const avgBattery =
    agents.length > 0 ? agents.reduce((s, a) => s + a.battery, 0) / agents.length : 0;
  const byzantineCount = agents.filter((a) => a.isByzantine).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Live swarm simulation</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Operator console for behaviors, BFT consensus, and FoxMQ-backed exploration. Toggle blackout stressors, watch
            relay insertion, and narrate Byzantine containment without leaving the browser — tuned to hold 60fps on
            mid-range laptops when the canvas is full screen.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => (isRunning ? pauseSimulation() : startSimulation())}>
            {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isRunning ? "Pause" : "Start"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSpeed(Math.min(5, speed + 0.5))}>
            <SkipForward className="w-3 h-3" /> {speed}x
          </Button>
          <Button size="sm" variant="ghost" onClick={resetSimulation}><RotateCcw className="w-3 h-3" /></Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">MODE:</span>
        {(["exploring", "rescue", "combined"] as const).map((mode) => (
          <Button key={mode} size="sm" variant={behaviorMode === mode ? "default" : "outline"} className="h-7 text-xs gap-1 capitalize" onClick={() => setBehaviorMode(mode)}>
            {mode === "exploring" && <Compass className="w-3 h-3" />}
            {mode === "rescue" && <Crosshair className="w-3 h-3" />}
            {mode === "combined" && <Layers className="w-3 h-3" />}
            {mode}
          </Button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border overflow-hidden bg-card/30">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-card/50">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="font-mono text-[10px] text-muted-foreground">LIVE — {activeCount} agents • {behaviorMode} • {byzantineCount > 0 ? `${byzantineCount} byzantine` : "all honest"}</span>
        </div>
        <SwarmScene className="w-full h-[350px]" animate={isRunning} />
      </motion.div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { label: "Active", value: activeCount },
          { label: "Battery", value: `${avgBattery.toFixed(0)}%` },
          { label: "Explored", value: `${explorationProgress.toFixed(0)}%` },
          { label: "Targets", value: targets.length },
          { label: "Consensus", value: `${consensusMetrics.successes}/${consensusMetrics.totalAttempts}` },
          { label: "Byzantine", value: byzantineCount },
        ].map((m) => (
          <Card key={m.label} className="bg-card/50 border-border">
            <CardContent className="p-2.5">
              <div className="font-mono text-base font-bold text-primary">{m.value}</div>
              <div className="text-[10px] text-muted-foreground">{m.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="blackout" className="w-full">
        <TabsList className="bg-card/50 border border-border flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="blackout" className="gap-1"><CloudOff className="w-3 h-3" />Blackout</TabsTrigger>
          <TabsTrigger value="webots" className="gap-1"><Box className="w-3 h-3" />Webots</TabsTrigger>
          <TabsTrigger value="p2p">P2P</TabsTrigger>
          <TabsTrigger value="consensus">BFT</TabsTrigger>
          <TabsTrigger value="behaviors">Behaviors</TabsTrigger>
          <TabsTrigger value="log">Event Log</TabsTrigger>
        </TabsList>
        <TabsContent value="blackout" className="mt-4">
          <BlackoutEnvironmentPanel />
        </TabsContent>
        <TabsContent value="webots" className="mt-4">
          <WebotsIntegrationPanel />
        </TabsContent>
        <TabsContent value="p2p" className="mt-4">
          <P2PCoordinationPanel />
        </TabsContent>
        <TabsContent value="consensus" className="mt-4">
          <BFTConsensusPanel />
        </TabsContent>
        <TabsContent value="behaviors" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ExplorationGrid />
            <TargetPanel />
            <TaskAllocationPanel />
            <RoleHandoffPanel />
          </div>
        </TabsContent>
        <TabsContent value="log" className="mt-4">
          <EventLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Webots Integration Panel                                           */
/* ------------------------------------------------------------------ */

const SCENARIOS = [
  { id: "tunnel", label: "Dynamic Daisy Chain", desc: "Tunnel relay formation with depth-based degradation", robots: 5, world: "tunnel.wbt" },
  { id: "open_field", label: "Fallen Comrade", desc: "Sector reallocation after rover failure", robots: 6, world: "open_field.wbt" },
  { id: "air_ground", label: "Blind Handoff", desc: "Air-ground victim rescue under low battery", robots: 6, world: "air_ground.wbt" },
] as const;

const LED_COLORS: Record<string, string> = {
  explorer: "bg-green-500",
  relay: "bg-blue-500",
  standby: "bg-orange-500",
  rescue: "bg-amber-400",
};

function WebotsIntegrationPanel() {
  const [selectedScenario, setSelectedScenario] = useState<string>("tunnel");
  const agents = useSwarmStore((s) => s.agents);

  const scenario = SCENARIOS.find((s) => s.id === selectedScenario) ?? SCENARIOS[0];

  return (
    <div className="space-y-4">
      {/* Scenario selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SCENARIOS.map((sc) => (
          <Card
            key={sc.id}
            className={`cursor-pointer transition-all border-2 ${
              selectedScenario === sc.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            }`}
            onClick={() => setSelectedScenario(sc.id)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Box className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm text-foreground">{sc.label}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{sc.desc}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-[10px]">{sc.robots} robots</Badge>
                <Badge variant="outline" className="text-[10px] font-mono">{sc.world}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Robot fleet status */}
        <Card className="border-border bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary" />
              Fleet Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {agents.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No agents connected — start simulation or connect Webots</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {agents.slice(0, 12).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-background/50">
                    <div className={`w-2 h-2 rounded-full ${LED_COLORS[a.role] ?? "bg-muted"}`} />
                    <span className="font-mono text-foreground flex-1">{a.id}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{a.role}</Badge>
                    <span className="text-muted-foreground">{a.battery.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
            {/* LED legend */}
            <div className="flex items-center gap-3 pt-2 border-t border-border/50">
              {Object.entries(LED_COLORS).map(([role, cls]) => (
                <div key={role} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${cls}`} />
                  <span className="text-[10px] text-muted-foreground capitalize">{role}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance & config */}
        <Card className="border-border bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              Simulation Config
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Timestep", value: "32 ms" },
                { label: "Physics", value: "Disabled", note: "Speed optimized" },
                { label: "Sensor model", value: "Mocked GPS" },
                { label: "Victim detect", value: "Proximity" },
                { label: "Network model", value: "Depth-based" },
                { label: "RNG Seed", value: "42" },
              ].map((item) => (
                <div key={item.label} className="p-2 rounded bg-background/50">
                  <div className="text-[10px] text-muted-foreground">{item.label}</div>
                  <div className="text-xs font-mono text-foreground">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 p-2 rounded border border-border/50 bg-background/30">
              <div className="text-[10px] text-muted-foreground mb-1">Quick launch (CLI)</div>
              <code className="text-[10px] text-primary font-mono block">
                ./scripts/run_webots.sh worlds/{scenario.world}
              </code>
              <code className="text-[10px] text-muted-foreground font-mono block mt-1">
                python scripts/run_headless.py --robots {scenario.robots}
              </code>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Architecture note */}
      <Card className="border-border bg-card/30">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <Activity className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Webots Integration:</strong> Each robot runs{" "}
              <code className="text-primary">swarm_controller.py</code> which wraps GPS + LED devices behind the same{" "}
              <code className="text-primary">DroneController</code> API used in headless tests. The depth-based{" "}
              <code className="text-primary">NetworkSimulator</code> dynamically adjusts link loss/latency per tick.
              Proto files and worlds are generated via <code className="text-primary">python -m swarm.robot_proto</code>.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
