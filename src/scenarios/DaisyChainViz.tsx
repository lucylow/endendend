import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useSwarmStore } from "@/stores/swarmStore";
import { phaseLabel } from "@/scenarios/dynamicDaisyChain/networkTimeline";
import { useDynamicDaisyChainStore } from "@/scenarios/dynamicDaisyChain/dynamicDaisyChainStore";
import { simNodeId } from "@/scenarios/dynamicDaisyChain/scenarioEngine";
import { ChainDebugger } from "@/scenarios/dynamicDaisyChain/webots/ChainDebugger";
import { DaisyChainWebotsPanel } from "@/scenarios/dynamicDaisyChain/webots/DaisyChainWebots";
import { SignalViz } from "@/scenarios/dynamicDaisyChain/webots/SignalViz";
import { Tunnel3D } from "@/scenarios/dynamicDaisyChain/webots/Tunnel3D";

function RelayScene({
  chain,
  depth,
  signal,
  nodePositions,
}: {
  chain: string[];
  depth: number;
  signal: Record<string, number>;
  nodePositions: { id: string; s: number; y: number }[];
}) {
  const positions = useMemo(() => {
    const n = Math.max(chain.length, 1);
    const span = 24;
    return chain.map((id, i) => {
      const pos = nodePositions.find((p) => p.id === id);
      const s = pos?.s ?? (i / Math.max(1, n - 1)) * depth;
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      return new THREE.Vector3(t * span, 1.2 + (pos?.y ?? Math.sin(i * 0.7) * 0.35), -s * 0.12);
    });
  }, [chain, depth, nodePositions]);

  const curve = useMemo(() => {
    if (positions.length < 2) return null;
    return new THREE.CatmullRomCurve3(positions, false, "catmullrom", 0.35);
  }, [positions]);

  const tubePoints = useMemo(() => {
    if (!curve) return [];
    return curve.getPoints(96);
  }, [curve]);

  return (
    <>
      <color attach="background" args={["#050608"]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[-20, 40, 10]} intensity={0.9} />
      <pointLight position={[0, 8, 0]} intensity={0.6} color="#b2ebf2" />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.02} />

      <Tunnel3D depthM={Math.max(depth, 120)} widthM={10} collapseAt={[40, 80, 120]} />

      {positions.map((pos, i) => {
        const id = chain[i] ?? `node-${i}`;
        const q = signal[id] ?? 0.55 + 0.15 * Math.sin(i);
        const hue = 0.28 + q * 0.15;
        const col = new THREE.Color().setHSL(hue, 0.65, 0.52);
        return (
          <group key={id} position={pos}>
            <mesh castShadow>
              <sphereGeometry args={[0.85, 20, 20]} />
              <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.25} />
            </mesh>
            <Text position={[0, 1.4, 0]} fontSize={0.55} color="#e2e8f0" anchorX="center" anchorY="bottom">
              {id}
            </Text>
          </group>
        );
      })}

      {tubePoints.length > 1 ? <Line points={tubePoints} color="#9575cd" lineWidth={1} /> : null}
    </>
  );
}

export default function DaisyChainViz() {
  const tunnelDepth = useSwarmStore((s) => s.tunnelDepth);
  const relayChain = useSwarmStore((s) => s.relayChain);
  const signalQuality = useSwarmStore((s) => s.signalQuality);
  const wsConnected = useSwarmStore((s) => s.wsConnected);

  const snapshot = useDynamicDaisyChainStore((s) => s.snapshot);
  const running = useDynamicDaisyChainStore((s) => s.running);
  const speed = useDynamicDaisyChainStore((s) => s.speed);
  const seed = useDynamicDaisyChainStore((s) => s.seed);
  const variant = useDynamicDaisyChainStore((s) => s.variant);
  const bridgeTrack2 = useDynamicDaisyChainStore((s) => s.bridgeTrack2);
  const replayMode = useDynamicDaisyChainStore((s) => s.replayMode);
  const replayFrames = useDynamicDaisyChainStore((s) => s.replay.frames.length);
  const transport = useDynamicDaisyChainStore((s) => s.transport);

  const setRunning = useDynamicDaisyChainStore((s) => s.setRunning);
  const setSpeed = useDynamicDaisyChainStore((s) => s.setSpeed);
  const setSeed = useDynamicDaisyChainStore((s) => s.setSeed);
  const setVariant = useDynamicDaisyChainStore((s) => s.setVariant);
  const setBridgeTrack2 = useDynamicDaisyChainStore((s) => s.setBridgeTrack2);
  const setTransport = useDynamicDaisyChainStore((s) => s.setTransport);
  const resetMission = useDynamicDaisyChainStore((s) => s.resetMission);
  const forceDegrade = useDynamicDaisyChainStore((s) => s.forceDegrade);
  const forceRelayPromote = useDynamicDaisyChainStore((s) => s.forceRelayPromote);
  const dropRelay = useDynamicDaisyChainStore((s) => s.dropRelay);
  const triggerRecovery = useDynamicDaisyChainStore((s) => s.triggerRecovery);
  const setReplayMode = useDynamicDaisyChainStore((s) => s.setReplayMode);
  const scrubReplay = useDynamicDaisyChainStore((s) => s.scrubReplay);

  const [ingressHistory, setIngressHistory] = useState<{ t: number; q: number }[]>([]);
  const lastT = useRef(0);

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.t === lastT.current) return;
    lastT.current = snapshot.t;
    setIngressHistory((h) => {
      const next = [...h, { t: snapshot.t, q: snapshot.relayPlan.ingressQuality }];
      return next.length > 240 ? next.slice(-240) : next;
    });
  }, [snapshot]);

  const displayChain = snapshot?.relayPlan.chainPath?.length
    ? snapshot.relayPlan.chainPath
    : relayChain.length
      ? relayChain
      : ["waiting…"];

  const displayDepth = snapshot?.nodes.find((n) => n.role === "lead_explorer")?.s ?? tunnelDepth;

  const mergedSignal = useMemo(() => {
    const o: Record<string, number> = { ...signalQuality };
    if (snapshot?.telemetry?.length) {
      for (const row of snapshot.telemetry) {
        o[row.nodeId] = row.linkIngress;
      }
    }
    return o;
  }, [signalQuality, snapshot?.telemetry]);

  const nodePositions = useMemo(() => {
    if (!snapshot?.nodes.length) return [];
    return snapshot.nodes.map((n) => ({
      id: simNodeId(n),
      s: n.s,
      y: n.isRelay ? 1.4 : 0.9,
    }));
  }, [snapshot?.nodes]);

  const orderedVizIds = useMemo(() => {
    if (!snapshot?.nodes.length) return [];
    return [...snapshot.nodes].sort((a, b) => a.s - b.s).map((n) => simNodeId(n));
  }, [snapshot?.nodes]);

  const geomSummary = snapshot
    ? `${Math.round(snapshot.map.coverage * 100)}% map · ${phaseLabel(snapshot.phase)} · backbone ${(snapshot.relayPlan.leadQuality * 100).toFixed(0)}%`
    : "Start mock mission";

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-gradient-to-br from-zinc-950 to-violet-950/30 md:flex-row">
      <div className="relative min-h-[280px] flex-1 md:min-h-0">
        <Canvas
          className="h-full w-full min-h-[260px]"
          shadows
          camera={{ position: [32, 22, 38], fov: 50 }}
          dpr={[1, 2]}
        >
          <RelayScene
            chain={orderedVizIds.length ? orderedVizIds : displayChain.filter((c) => c !== "entrance")}
            depth={Math.max(displayDepth, 1)}
            signal={mergedSignal}
            nodePositions={nodePositions}
          />
        </Canvas>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-2 border-t border-border/60 bg-black/50 p-3 text-xs text-white backdrop-blur md:w-[min(100%,380px)] md:border-l md:border-t-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-violet-200">Dynamic Daisy Chain</span>
          <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
            {wsConnected && transport === "live" ? "live ws" : "mock engine"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant={running ? "secondary" : "default"} onClick={() => setRunning(!running)} className="h-8 text-[11px]">
            {running ? "Pause" : "Run mission"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => resetMission()} className="h-8 text-[11px]">
            Reset
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={bridgeTrack2} onCheckedChange={setBridgeTrack2} id="bridge" />
            <Label htmlFor="bridge" className="text-[11px] text-slate-300">
              Bridge to Track2 HUD
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={transport === "live"}
              onCheckedChange={(v) => setTransport(v ? "live" : "mock")}
              id="transport"
            />
            <Label htmlFor="transport" className="text-[11px] text-slate-300">
              Prefer live WS when up
            </Label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
          <label className="text-muted-foreground">
            Speed ×{speed.toFixed(1)}
            <Slider min={0.2} max={4} step={0.1} value={[speed]} onValueChange={(v) => setSpeed(v[0] ?? 1)} className="mt-1" />
          </label>
          <label className="text-muted-foreground">
            Seed {seed}
            <Slider min={1} max={99999} step={1} value={[seed]} onValueChange={(v) => setSeed(Math.floor(v[0] ?? 42))} className="mt-1" />
          </label>
        </div>

        <div className="flex flex-wrap gap-1">
          {(
            ["default", "deep", "narrow", "collapsed", "noisy", "relay_heavy", "target_rich"] as const
          ).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={variant === v ? "default" : "outline"}
              className="h-7 px-2 text-[10px]"
              onClick={() => setVariant(v)}
            >
              {v}
            </Button>
          ))}
        </div>

        <div className="rounded border border-white/10 bg-black/40 p-2 font-mono text-[11px]">
          <div className="text-violet-200">Mission</div>
          <div>{geomSummary}</div>
          <div className="mt-1 text-slate-300">Depth {displayDepth.toFixed(1)} m</div>
          <div className="mt-1 break-all text-slate-400">
            Chain: {displayChain.filter((x) => x !== "waiting…").join(" → ") || "—"}
          </div>
        </div>

        <div className="h-28 w-full rounded border border-white/10 bg-black/30 p-1">
          <SignalViz data={ingressHistory} title="Ingress quality" height={104} />
        </div>

        <DaisyChainWebotsPanel />
        <ChainDebugger />

        <div className="grid grid-cols-2 gap-1">
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => forceDegrade()}>
            Force degrade
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => forceRelayPromote()}>
            Force relay
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => dropRelay("drone_1")}>
            Drop relay 1
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => triggerRecovery()}>
            Recovery
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" className="h-7 text-[10px]" onClick={() => setReplayMode(!replayMode)}>
            Replay {replayMode ? "on" : "off"}
          </Button>
          <span className="text-[10px] text-slate-400">{replayFrames} frames</span>
        </div>
        {replayMode ? (
          <Slider
            min={0}
            max={Math.max(0.1, snapshot?.t ?? 1)}
            step={0.05}
            value={[snapshot?.t ?? 0]}
            onValueChange={(v) => scrubReplay(v[0] ?? 0)}
            className="py-1"
          />
        ) : null}

        <div className="min-h-0 flex-1">
          <div className="mb-1 text-[10px] text-violet-200">Roster</div>
          <ScrollArea className="h-24 rounded border border-white/10 pr-2">
            <ul className="space-y-1 p-1 font-mono text-[10px] text-slate-300">
              {(snapshot?.nodes ?? []).map((n) => (
                <li key={simNodeId(n)} className="flex justify-between gap-2">
                  <span className="truncate">
                    {n.profile.displayName} · {n.role}
                  </span>
                  <span className="shrink-0 text-slate-400">{n.battery.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>

        <div className="min-h-0 flex-1">
          <div className="mb-1 text-[10px] text-violet-200">Tasks</div>
          <ScrollArea className="h-20 rounded border border-white/10 pr-2">
            <ul className="space-y-1 p-1 font-mono text-[10px] text-slate-300">
              {(snapshot?.tasks ?? []).map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span className="truncate">{t.title}</span>
                  <span className="shrink-0 text-slate-400">{t.status}</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>

        <div className="min-h-0 flex-1">
          <div className="mb-1 text-[10px] text-violet-200">Events</div>
          <ScrollArea className="h-28 rounded border border-white/10 pr-2">
            <ul className="space-y-1 p-1 font-mono text-[9px] leading-tight text-slate-400">
              {(snapshot?.events ?? [])
                .slice(-40)
                .reverse()
                .map((e) => (
                  <li key={e.id}>
                    <span className="text-violet-300/80">{e.type}</span> {e.message}
                  </li>
                ))}
            </ul>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
