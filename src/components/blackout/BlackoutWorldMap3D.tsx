import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EXPLORER_TRAIL_MAX = 20;
const PULSE_MS = 1000;

type Pulse = { id: string; x: number; z: number; start: number };

function posFor(nodeId: string, nodes: VertexSwarmView["nodes"]): THREE.Vector3 | null {
  const n = nodes.find((x) => x.nodeId === nodeId);
  if (!n) return null;
  return new THREE.Vector3(n.position.x * 0.08, n.position.y * 0.08 + 0.35, n.position.z * 0.08);
}

const RelayGlowLines = memo(function RelayGlowLines({ view }: { view: VertexSwarmView }) {
  const chains = view.graph.relayChains ?? [];
  const segs: THREE.Vector3[][] = [];
  for (const chain of chains) {
    const pts: THREE.Vector3[] = [];
    for (const id of chain) {
      const p = posFor(id, view.nodes);
      if (p) pts.push(p);
    }
    if (pts.length >= 2) segs.push(pts);
  }
  if (!segs.length) return null;
  return (
    <group>
      {segs.map((pts, i) => (
        <group key={i}>
          <Line
            points={pts}
            color="#22d3ee"
            lineWidth={2}
            transparent
            opacity={0.35}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
          <Line
            points={pts}
            color="#67e8f9"
            lineWidth={1}
            transparent
            opacity={0.5}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </group>
      ))}
    </group>
  );
});

const PulseRings = memo(function PulseRings({ pulses }: { pulses: Pulse[] }) {
  return (
    <group>
      {pulses.map((p) => {
        const age = (performance.now() - p.start) / PULSE_MS;
        if (age >= 1) return null;
        const s = 0.4 + age * 2.2;
        const op = (1 - age) * 0.55;
        return (
          <mesh key={p.id} position={[p.x, 0.05, p.z]} rotation={[-Math.PI / 2, 0, age * 4]}>
            <ringGeometry args={[s, s + 0.12, 28]} />
            <meshBasicMaterial color="#fb7185" transparent opacity={op} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
});

const WildfireHeat = memo(function WildfireHeat({ intensity01 }: { intensity01: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((st) => {
    if (!ref.current) return;
    const m = ref.current.material as THREE.MeshBasicMaterial;
    m.opacity = 0.12 + intensity01 * 0.35 + Math.sin(st.clock.elapsedTime * 1.4) * 0.04;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <planeGeometry args={[14, 14]} />
      <meshBasicMaterial color="#7f1d1d" transparent opacity={0.22} depthWrite={false} />
    </mesh>
  );
});

const FloodPlane = memo(function FloodPlane({ level01 }: { level01: number }) {
  const y = 0.15 + level01 * 1.1;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <planeGeometry args={[16, 16]} />
      <meshStandardMaterial color="#0ea5e9" transparent opacity={0.28} roughness={0.9} metalness={0.05} depthWrite={false} />
    </mesh>
  );
});

const GasContour = memo(function GasContour({ reading01 }: { reading01: number }) {
  const rings = [0.6, 1.1, 1.6, 2.1];
  return (
    <group position={[2, 0.08, -1]}>
      {rings.map((r, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r, r + 0.08, 40]} />
          <meshBasicMaterial
            color={i % 2 ? "#ea580c" : "#dc2626"}
            transparent
            opacity={0.08 + reading01 * 0.22 - i * 0.03}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
});

const Drones = memo(function Drones({ view, trail }: { view: VertexSwarmView; trail: THREE.Vector3[] }) {
  return (
    <group>
      {trail.length >= 2 ? (
        <Line points={trail} color="#38bdf8" lineWidth={2} transparent opacity={0.38} />
      ) : null}
      {view.nodes.map((n) => {
        const p = posFor(n.nodeId, view.nodes);
        if (!p) return null;
        const hue = n.role === "explorer" ? "#38bdf8" : n.role === "relay" ? "#a78bfa" : "#34d399";
        return (
          <mesh key={n.nodeId} position={p}>
            <sphereGeometry args={[n.offline ? 0.12 : 0.18, 16, 16]} />
            <meshStandardMaterial color={hue} emissive={hue} emissiveIntensity={n.offline ? 0 : 0.35} roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
});

function Scene({ view, trail, pulses, scenario }: { view: VertexSwarmView; trail: THREE.Vector3[]; pulses: Pulse[]; scenario: string }) {
  const frontierIntensity = Math.min(1, (view.sharedMap.frontier ?? 0) / 24);
  const waterLevel = (Math.sin(view.tickCount * 0.08) * 0.5 + 0.5) * 0.85;
  const gasReading = view.telemetry.reduce((a, t) => a + t.sensorConfidence01, 0) / Math.max(1, view.telemetry.length);

  return (
    <>
      <color attach="background" args={["#050508"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[8, 14, 6]} intensity={0.85} castShadow />
      <gridHelper args={[20, 40, "#1e293b", "#0f172a"]} position={[0, 0.01, 0]} />
      <RelayGlowLines view={view} />
      <PulseRings pulses={pulses} />
      {scenario === "wildfire" ? <WildfireHeat intensity01={frontierIntensity} /> : null}
      {scenario === "flood_rescue" ? <FloodPlane level01={waterLevel} /> : null}
      {scenario === "hazmat" ? <GasContour reading01={gasReading} /> : null}
      <Drones view={view} trail={trail} />
    </>
  );
}

export const BlackoutWorldMap3D = memo(function BlackoutWorldMap3D({
  view,
  scenario,
}: {
  view: VertexSwarmView | null;
  scenario: string | null | undefined;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const trailRef = useRef<THREE.Vector3[]>([]);
  const prevConfirmedRef = useRef<Set<string>>(new Set());
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [trail, setTrail] = useState<THREE.Vector3[]>([]);

  const explorerId = useMemo(() => view?.nodes.find((n) => n.role === "explorer")?.nodeId ?? null, [view?.nodes]);

  useEffect(() => {
    if (!view || !explorerId) {
      trailRef.current = [];
      setTrail([]);
      return;
    }
    const p = posFor(explorerId, view.nodes);
    if (!p) return;
    const prev = trailRef.current;
    const last = prev[prev.length - 1];
    if (!last || last.distanceToSquared(p) > 1e-4) {
      prev.push(p.clone());
      trailRef.current = prev.slice(-EXPLORER_TRAIL_MAX);
      setTrail([...trailRef.current]);
    }
  }, [view, explorerId]);

  useEffect(() => {
    if (!view) return;
    const next: Pulse[] = [];
    const cur = new Set<string>();
    for (const d of view.discovery) {
      if (d.status === "confirmed") cur.add(d.candidateId);
      if (d.status === "confirmed" && !prevConfirmedRef.current.has(d.candidateId)) {
        next.push({
          id: `${d.candidateId}-${view.nowMs}`,
          x: d.world.x * 0.08,
          z: d.world.z * 0.08,
          start: performance.now(),
        });
      }
    }
    prevConfirmedRef.current = cur;
    if (next.length) setPulses((p) => [...p, ...next].slice(-12));
  }, [view, view?.discovery, view?.nowMs]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now();
      setPulses((p) => p.filter((x) => now - x.start < PULSE_MS + 200));
    }, 400);
    return () => window.clearInterval(id);
  }, []);

  const resetCamera = useCallback(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.reset();
    const cam = c.object as THREE.PerspectiveCamera;
    cam.position.set(0, 9, 11);
    c.target.set(0, 0, 0);
    c.update();
  }, []);

  if (!view) {
    return (
      <div className="h-[280px] rounded-lg border border-zinc-800 bg-zinc-950/80 flex items-center justify-center text-xs text-muted-foreground">
        No swarm view for 3D map.
      </div>
    );
  }

  const sc = scenario ?? view.scenario;

  return (
    <div className="space-y-2" data-tour="map3d">
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" className="min-h-11 text-xs" onClick={resetCamera}>
          Reset camera
        </Button>
      </div>
      <div className={cn("h-[min(52vh,420px)] min-h-[280px] rounded-lg border border-cyan-500/20 overflow-hidden bg-black")}>
        <Canvas
          shadows
          camera={{ position: [0, 9, 11], fov: 48, near: 0.1, far: 200 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
        >
          <Scene view={view} trail={trail} pulses={pulses} scenario={sc} />
          <OrbitControls
            ref={controlsRef}
            enablePan
            enableZoom
            minDistance={4}
            maxDistance={28}
            maxPolarAngle={Math.PI / 2 - 0.08}
          />
        </Canvas>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Explorer trail (last {EXPLORER_TRAIL_MAX} samples), victim pulse rings, relay-chain cyan glow (additive), and scenario overlays
        (wildfire / flood / hazmat). Orbit · pan · zoom.
      </p>
    </div>
  );
});
