import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import ScenarioWalkthroughPanel from "@/components/scenarios/ScenarioWalkthroughPanel";
import { getScenarioWalkthrough } from "@/lib/scenarios/scenarioWalkthroughs";
import { motion } from "framer-motion";
import { LifeBuoy, Sparkles, Radio, ChevronRight, ChevronDown, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import MasterCanvas from "@/components/swarm/MasterCanvas";
import SarKpiPanel from "@/components/metrics/SarKpiPanel";
import PathfindingViz from "@/components/metrics/PathfindingViz";
import { SAR_SCENARIOS, getScenarioBySlug, type ScenarioDefinition } from "@/lib/scenarios/registry";
import { applyScenarioToSwarm } from "@/lib/scenarios/applyScenario";
import { useScenarioOrchestratorStore, type ChaosLevel } from "@/store/scenarioOrchestratorStore";
import { useSwarmStore } from "@/store/swarmStore";
import type { CameraMode } from "@/features/swarm/useSwarmVisualization";
import BackendBridgeStrip from "@/components/tashi/BackendBridgeStrip";
import { readSwarmBackendHttpBase, SwarmGatewayClient } from "@/lib/tashi-sdk/swarmGatewayClient";
import { VertexSwarm } from "@/lib/tashi-sdk/vertex";
import { getScenarioBrief } from "@/lib/scenarios/scenarioBriefs";
import ScenarioBriefPanel from "@/components/scenarios/ScenarioBriefPanel";
import BatteryCascadeScenario from "@/scenarios/battery-cascade/BatteryCascadeScenario";
import CircularBypassScenario from "@/scenarios/obstacle-bypass/CircularBypassScenario";
import StakeVotingScenario from "@/scenarios/stake-voting/StakeVotingScenario";
import PredatorEvasionScenario from "@/scenarios/predator-evasion/PredatorEvasionScenario";
import PriorityMetricsPanel from "@/lib/scenarios/victim-priority/PriorityMetricsPanel";
import HandoffMetrics from "@/scenarios/multi-swarm-handoff/HandoffMetrics";
import HandoverControls from "@/scenarios/multi-swarm-handoff/HandoverControls";
import { resetScenarioVizForSlug } from "@/store/scenarioVizStore";
import { cn } from "@/lib/utils";

export default function SearchRescueDemo() {
  const { scenarioSlug } = useParams<{ scenarioSlug: string }>();
  const resolved = scenarioSlug ? getScenarioBySlug(scenarioSlug) : undefined;
  if (!resolved) {
    return <Navigate to={`/scenarios/search-rescue/${SAR_SCENARIOS[0].slug}`} replace />;
  }
  if (resolved.slug === "arena-race") {
    return <Navigate to="/scenarios/arena-obstacle" replace />;
  }
  if (resolved.slug === "warehouse-restock") {
    return <Navigate to="/scenarios/warehouse-restock" replace />;
  }
  return <SearchRescueDemoContent scenario={resolved} />;
}

function SearchRescueDemoContent({ scenario }: { scenario: ScenarioDefinition }) {
  const navigate = useNavigate();
  const mainRegionId = useId();
  const mainDomId = `sar-demo-main-${mainRegionId.replace(/:/g, "")}`;

  const chaosLevel = useScenarioOrchestratorStore((s) => s.chaosLevel);
  const setChaosLevel = useScenarioOrchestratorStore((s) => s.setChaosLevel);
  const bumpPerformanceDemo = useScenarioOrchestratorStore((s) => s.bumpPerformanceDemo);

  const isRunning = useSwarmStore((s) => s.isRunning);
  const agents = useSwarmStore((s) => s.agents);

  const [cameraMode, setCameraMode] = useState<CameraMode>(scenario.viz.cameraDefault);
  const [tunnelMode, setTunnelMode] = useState(scenario.viz.tunnelMode);
  const [showTrails, setShowTrails] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [connectionMode, setConnectionMode] = useState<"relay-chain" | "proximity">(scenario.viz.connectionMode);
  const [agentScale, setAgentScale] = useState(1);
  const [showStats, setShowStats] = useState(false);
  const [showDemoScript, setShowDemoScript] = useState(true);

  const scenarioWalkthrough = useMemo(() => getScenarioWalkthrough(scenario.slug), [scenario.slug]);
  const scenarioBrief = useMemo(() => getScenarioBrief(scenario.slug), [scenario.slug]);

  useEffect(() => {
    resetScenarioVizForSlug(scenario.slug);
  }, [scenario.slug]);

  useEffect(() => {
    setCameraMode(scenario.viz.cameraDefault);
    setTunnelMode(scenario.viz.tunnelMode);
    setConnectionMode(scenario.viz.connectionMode);
  }, [scenario.slug, scenario.viz.cameraDefault, scenario.viz.tunnelMode, scenario.viz.connectionMode]);

  useEffect(() => {
    applyScenarioToSwarm(scenario, chaosLevel);
  }, [scenario, chaosLevel]);

  const pickScenario = useCallback(
    (slug: string) => {
      navigate(`/scenarios/search-rescue/${slug}`);
      bumpPerformanceDemo();
    },
    [navigate, bumpPerformanceDemo],
  );

  const meshGateway = useMemo(() => {
    const base = readSwarmBackendHttpBase();
    return base ? new SwarmGatewayClient(base) : null;
  }, []);

  const runVertexDemo = useCallback(async () => {
    const ids = agents.filter((a) => a.status === "active").map((a) => a.id);
    const vs = new VertexSwarm({ meshGateway });
    toast.message("Vertex + FoxMQ", { description: "Stake-weighted broadcast → BFT task_acceptance" });
    await vs.consensusVote(ids.slice(0, 5), {
      id: "path-1",
      waypoints: [
        { x: 0, y: 0, z: 0 },
        { x: 4, y: 0, z: 6 },
      ],
      score: 0.88,
    });
    toast.success("Consensus path committed (sim)");
  }, [agents, meshGateway]);

  const phaseGroups = useMemo(
    () => ({
      1: SAR_SCENARIOS.filter((s) => s.phase === 1),
      2: SAR_SCENARIOS.filter((s) => s.phase === 2),
      3: SAR_SCENARIOS.filter((s) => s.phase === 3),
    }),
    [],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href={`#${mainDomId}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to scenario content
      </a>
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              to="/"
              className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <LifeBuoy className="h-4 w-4 text-primary" aria-hidden />
              Home
            </Link>
            <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />
            <div className="min-w-0">
              <div className="truncate font-semibold text-sm sm:text-base">
                <span className="text-primary">Vertex</span> Swarm SAR
              </div>
              <p className="truncate text-xs text-muted-foreground sm:hidden">
                {scenario.emoji} {scenario.name}
              </p>
            </div>
            <Badge variant="outline" className="hidden shrink-0 font-mono text-[10px] border-emerald-500/40 text-emerald-400 md:inline-flex">
              16 scenarios
            </Badge>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {scenario.slug === "multi-swarm-handoff" ? <HandoverControls /> : null}
            <Button variant="outline" size="sm" className="hidden h-8 text-xs sm:inline-flex" asChild>
              <Link to="/dashboard/scenarios">Scenario index</Link>
            </Button>
            <Button variant="outline" size="sm" className="hidden h-8 text-xs sm:inline-flex" asChild>
              <Link to="/dashboard/swarm">Classic viz</Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 gap-1 text-xs"
              aria-pressed={showStats}
              aria-label={showStats ? "Hide renderer stats overlay" : "Show renderer stats overlay"}
              onClick={() => setShowStats((v) => !v)}
            >
              <Radio className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{showStats ? "Hide" : "Show"} r3f stats</span>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border/50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,hsl(270_60%_35%/0.35),transparent_55%),radial-gradient(ellipse_at_80%_40%,hsl(160_50%_30%/0.2),transparent_45%)]" />
        <div className="relative mx-auto max-w-[1600px] px-4 py-12 sm:px-6 sm:py-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet-400 mb-3 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Unbreakable warehouse intelligence
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-emerald-300 bg-clip-text text-transparent">
                Search &amp; Rescue
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground text-base leading-relaxed">
              Sixteen failure-proof scenarios across exploration, extraction, and production validation — live 3D swarm,
              FoxMQ exploration sync, and Vertex-weighted consensus in one judge-ready flow.
            </p>
            <div className="mt-4 max-w-2xl">
              <BackendBridgeStrip />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">99.99% target @ chaos 0</Badge>
              <Badge className="bg-violet-500/15 text-violet-200 border-violet-500/30">3.2× vs static (design goal)</Badge>
              <Badge className="bg-cyan-500/15 text-cyan-200 border-cyan-500/30">Zero-downtime handoffs</Badge>
            </div>
          </motion.div>
        </div>
      </section>

      <main
        id={mainDomId}
        tabIndex={-1}
        className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
      >
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-1">Scenario carousel</h2>
          <p className="text-sm text-muted-foreground mb-4">Swipe or use arrows — click a card to load the live preset.</p>
          <div className="relative px-10 sm:px-14">
            <Carousel opts={{ align: "start", loop: true }} className="w-full">
              <CarouselContent className="-ml-2 md:-ml-3">
                {SAR_SCENARIOS.map((s) => (
                  <CarouselItem key={s.slug} className="pl-2 md:pl-3 basis-full sm:basis-1/2 lg:basis-1/3">
                    <button
                      type="button"
                      onClick={() => pickScenario(s.slug)}
                      className={cn(
                        "w-full text-left rounded-2xl border p-4 transition-all h-full min-h-[140px]",
                        "bg-card/50 hover:bg-card/80 hover:border-primary/40 backdrop-blur-sm",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                        scenario.slug === s.slug ? "border-primary/60 ring-1 ring-primary/25" : "border-border/80",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-2xl">{s.emoji}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          Phase {s.phase}
                        </Badge>
                      </div>
                      <h3 className="mt-2 font-semibold text-foreground">{s.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.tagline}</p>
                    </button>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-0 border-border bg-background/90" />
              <CarouselNext className="right-0 border-border bg-background/90" />
            </Carousel>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Live selector</h2>
          <ScrollArea className="w-full whitespace-nowrap rounded-xl border border-border/80 bg-muted/20 p-2">
            <div className="flex gap-2 pb-1">
              {([1, 2, 3] as const).map((ph) => (
                <div key={ph} className="flex gap-2 pr-4 border-r border-border/60 last:border-0">
                  <span className="text-[10px] font-mono text-muted-foreground self-center px-1">P{ph}</span>
                  {phaseGroups[ph].map((s) => (
                    <Button
                      key={s.slug}
                      variant={scenario.slug === s.slug ? "default" : "ghost"}
                      size="sm"
                      className="shrink-0 h-8 text-xs gap-1"
                      onClick={() => pickScenario(s.slug)}
                    >
                      <span>{s.emoji}</span>
                      <span className="hidden lg:inline max-w-[9rem] truncate">{s.name}</span>
                    </Button>
                  ))}
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_min(380px,100%)]">
          <div className="space-y-4">
            <div className="relative min-h-[56vh] w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-zinc-900 to-black shadow-2xl">
              {scenario.slug === "battery-cascade" ? (
                <div className="relative z-10 h-full min-h-[56vh]">
                  <BatteryCascadeScenario embedded />
                </div>
              ) : scenario.slug === "circular-bypass" ? (
                <div className="relative z-10 h-full min-h-[56vh]">
                  <CircularBypassScenario embedded />
                </div>
              ) : scenario.slug === "stake-voting" ? (
                <div className="relative z-10 h-full min-h-[56vh]">
                  <StakeVotingScenario embedded />
                </div>
              ) : scenario.slug === "predator-evasion" ? (
                <div className="relative z-10 h-full min-h-[56vh]">
                  <PredatorEvasionScenario embedded />
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 z-10">
                    <MasterCanvas
                      cameraMode={cameraMode}
                      tunnelMode={tunnelMode}
                      showTrails={showTrails}
                      showConnections={showConnections}
                      connectionMode={connectionMode}
                      agentScale={agentScale}
                      animate={isRunning}
                      showPerformanceOverlay={showStats}
                      scenarioSlug={scenario.slug}
                    />
                  </div>
                  <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 flex flex-wrap gap-2 text-[10px] font-mono text-zinc-500">
                    <span className="rounded-md bg-black/50 px-2 py-1 backdrop-blur">ACES tone map</span>
                    <span className="rounded-md bg-black/50 px-2 py-1 backdrop-blur">Shadows on</span>
                    <span className="rounded-md bg-black/50 px-2 py-1 backdrop-blur">
                      {isRunning ? "SIM RUNNING" : "SIM IDLE"}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-3 rounded-2xl border border-border/80 bg-card/30 p-4 backdrop-blur-sm">
              <div className="flex flex-1 min-w-[200px] flex-col gap-2">
                <span className="text-xs text-muted-foreground">Chaos engineering (packet / byzantine)</span>
                <Slider
                  value={[chaosLevel]}
                  min={0}
                  max={3}
                  step={1}
                  onValueChange={(v) => setChaosLevel((v[0] ?? 0) as ChaosLevel)}
                />
                <span className="font-mono text-[10px] text-muted-foreground">Level {chaosLevel} — ties to random-failure & tunnel-collapse presets</span>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowTrails((t) => !t)}>
                  Trails {showTrails ? "off" : "on"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowConnections((t) => !t)}>
                  Links {showConnections ? "off" : "on"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTunnelMode((t) => !t)}>
                  Tunnel {tunnelMode ? "off" : "on"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConnectionMode((m) => (m === "relay-chain" ? "proximity" : "relay-chain"))}>
                  {connectionMode === "relay-chain" ? "Proximity" : "Relay"} links
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCameraMode("orbit")}>
                  Cam: orbit
                </Button>
                <Button size="sm" className="gap-1 bg-violet-600 hover:bg-violet-500" onClick={runVertexDemo}>
                  Vertex vote <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
              <div className="w-full min-w-[200px] max-w-xs">
                <span className="text-xs text-muted-foreground">Agent scale</span>
                <Slider value={[agentScale]} min={0.5} max={2} step={0.05} onValueChange={(v) => setAgentScale(v[0] ?? 1)} />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
              <h3 className="text-sm font-semibold mb-1">Judge beat</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{scenario.judgeBeat}</p>
              <p className="mt-2 text-xs text-violet-300/90">{scenario.pitch}</p>
            </div>

            {scenarioBrief ? <ScenarioBriefPanel brief={scenarioBrief} /> : null}

            {scenario.demoScript ? (
              <Collapsible open={showDemoScript} onOpenChange={setShowDemoScript}>
                <div className="rounded-2xl border border-violet-500/25 bg-violet-950/20 p-4">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-violet-200 hover:text-violet-100"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 shrink-0 opacity-80" />
                        Example scenario 1 — full script
                      </span>
                      <ChevronDown
                        className={cn("h-4 w-4 shrink-0 transition-transform", showDemoScript ? "rotate-180" : "")}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4 text-sm text-muted-foreground leading-relaxed">
                    <p className="text-xs font-mono uppercase tracking-wider text-violet-400/90">
                      {scenario.demoScript.promptTitle}
                    </p>
                    <div>
                      <h4 className="text-foreground font-medium text-xs mb-1">Setting</h4>
                      <p>{scenario.demoScript.setting}</p>
                    </div>
                    <div>
                      <h4 className="text-foreground font-medium text-xs mb-1">Goal</h4>
                      <p>{scenario.demoScript.goal}</p>
                    </div>
                    <div>
                      <h4 className="text-foreground font-medium text-xs mb-1">Key behaviors</h4>
                      <ul className="list-disc pl-4 space-y-1">
                        {scenario.demoScript.behaviors.map((b) => (
                          <li key={b.slice(0, 48)}>{b}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-foreground font-medium text-xs mb-1">Architecture</h4>
                      <ul className="space-y-1.5">
                        {scenario.demoScript.architecture.map((row) => (
                          <li key={row.component}>
                            <span className="text-violet-200/90">{row.component}</span>
                            <span className="text-muted-foreground"> — {row.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-foreground font-medium text-xs mb-1">Operator flow</h4>
                      <ol className="list-decimal pl-4 space-y-1">
                        {scenario.demoScript.operatorFlow.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                      <h4 className="text-foreground font-medium text-sm mb-1">{scenario.demoScript.baselineTest.title}</h4>
                      <p className="text-xs mb-2">{scenario.demoScript.baselineTest.summary}</p>
                      <p className="text-[11px] font-semibold text-foreground/90 mb-1">Setup</p>
                      <ul className="list-disc pl-4 text-xs space-y-0.5 mb-2">
                        {scenario.demoScript.baselineTest.setup.map((s) => (
                          <li key={s.slice(0, 36)}>{s}</li>
                        ))}
                      </ul>
                      <p className="text-[11px] font-semibold text-foreground/90 mb-1">Procedure</p>
                      <ol className="list-decimal pl-4 text-xs space-y-0.5 mb-2">
                        {scenario.demoScript.baselineTest.procedure.map((s) => (
                          <li key={s.slice(0, 36)}>{s}</li>
                        ))}
                      </ol>
                      <p className="text-[11px] font-semibold text-emerald-400/90 mb-1">Pass criteria</p>
                      <ul className="list-disc pl-4 text-xs space-y-0.5">
                        {scenario.demoScript.baselineTest.passCriteria.map((s) => (
                          <li key={s.slice(0, 36)}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    {scenario.demoScript.extendedValidation.map((block) => (
                      <div key={block.title}>
                        <h4 className="text-foreground font-medium text-xs mb-1">{block.title}</h4>
                        <ul className="list-disc pl-4 space-y-0.5 text-xs">
                          {block.bullets.map((b, j) => (
                            <li key={j}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <div>
                      <h4 className="text-foreground font-medium text-xs mb-1">Python / sim artifacts</h4>
                      <ul className="font-mono text-[11px] space-y-0.5 text-violet-300/80">
                        {scenario.demoScript.pythonArtifacts.map((a) => (
                          <li key={a.path}>
                            {a.label}: <span className="text-muted-foreground">{a.path}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ) : null}
          </div>

          <div className="space-y-4">
            {scenarioWalkthrough ? <ScenarioWalkthroughPanel walkthrough={scenarioWalkthrough} /> : null}
            {scenario.slug === "victim-priority" ? <PriorityMetricsPanel /> : null}
            {scenario.slug === "multi-swarm-handoff" ? <HandoffMetrics /> : null}
            <SarKpiPanel scenario={scenario} />
            <PathfindingViz />
          </div>
        </div>

        <footer className="mt-12 border-t border-border/60 pt-8 text-center text-xs text-muted-foreground">
          <p>
            Stack: Vite · React 18 · r3f 8 · drei 9 · Zustand 5 · Framer Motion · Recharts · FoxMQ client (existing) · Vertex
            consensus (sim).
          </p>
          <p className="mt-2">
            <Link to="/dashboard/scenarios" className="text-primary hover:underline">
              Dashboard scenarios
            </Link>
            {" · "}
            <Link to="/vertex-swarm" className="text-primary hover:underline">
              Relay chain landing
            </Link>
          </p>
        </footer>
      </div>
      </main>
    </div>
  );
}
