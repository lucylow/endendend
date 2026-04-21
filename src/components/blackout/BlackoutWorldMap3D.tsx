import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMapOverlayStore } from "@/store/mapOverlayStore";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { parseCellKey } from "@/swarm/sharedMap";

const EXPLORER_TRAIL_MAX = 20;
const PULSE_MS = 1000;
const MAX_DRONE_INSTANCES = 24;
const MAX_CELL_INSTANCES = 900;

type Pulse = { id: string; x: number; z: number; start: number };

function posFor(nodeId: string, nodes: VertexSwarmView["nodes"]): THREE.Vector3 | null {
  const n = nodes.find((x) => x.nodeId === nodeId);
  if (!n) return null;
  return new THREE.Vector3(n.position.x * 0.08, n.position.y * 0.08 + 0.35, n.position.z * 0.08);
}

const heatShader = {
  uniforms: {
    uTime: { value: 0 },
    uOpacity: { value: 0.5 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float uTime;
    uniform float uOpacity;
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      vec2 firePos = vec2(sin(uTime * 0.55) * 0.55, cos(uTime * 0.42) * 0.48);
      float d = length(p - firePos);
      float heat = smoothstep(0.82, 0.0, d);
      vec3 c = mix(vec3(0.12, 0.03, 0.02), vec3(1.0, 0.32, 0.06), heat);
      float a = uOpacity * (0.18 + 0.72 * heat);
      gl_FragColor = vec4(c, a);
    }
  `,
};

const waterShader = {
  uniforms: {
    uTime: { value: 0 },
    uOpacity: { value: 0.35 },
    uLevel: { value: 0.35 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float uTime;
    uniform float uOpacity;
    uniform float uLevel;
    void main() {
      float w = sin((vUv.x + vUv.y) * 10.0 + uTime * 1.8) * 0.04;
      float a = uOpacity * (0.28 + w + uLevel * 0.15);
      vec3 col = vec3(0.04, 0.45, 0.82);
      gl_FragColor = vec4(col, clamp(a, 0.05, 0.92));
    }
  `,
};

function RelayAnimatedLines({ view }: { view: VertexSwarmView }) {
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
            opacity={0.38}
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
}

const PulseRings = memo(function PulseRings({ pulses, reducedMotion }: { pulses: Pulse[]; reducedMotion: boolean }) {
  return (
    <group>
      {pulses.map((p) => {
        const age = (performance.now() - p.start) / PULSE_MS;
        if (age >= 1) return null;
        const s = 0.4 + age * 2.2;
        const op = (1 - age) * 0.55;
        return (
          <mesh key={p.id} position={[p.x, 0.05, p.z]} rotation={[-Math.PI / 2, 0, reducedMotion ? 0 : age * 4]}>
            <ringGeometry args={[s, s + 0.12, 28]} />
            <meshBasicMaterial color="#fb7185" transparent opacity={op} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
});

function InstancedDrones({
  view,
  selectedId,
  reducedMotion,
}: {
  view: VertexSwarmView;
  selectedId: string | null;
  reducedMotion: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const { camera } = useThree();
  const pulseRef = useRef(0);

  useFrame((st) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    pulseRef.current += st.clock.getDelta();
    let i = 0;
    const camDist = camera.position.length();
    const lodFar = camDist > 19;
    for (const n of view.nodes) {
      if (i >= MAX_DRONE_INSTANCES) break;
      const p = posFor(n.nodeId, view.nodes);
      if (!p) continue;
      dummy.position.copy(p);
      const sel = selectedId === n.nodeId;
      const pulse = sel && !reducedMotion ? 1 + Math.sin(pulseRef.current * 6) * 0.12 : 1;
      const base = lodFar ? 0.11 : n.offline ? 0.1 : 0.16;
      dummy.scale.setScalar(base * pulse);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (n.role === "explorer") color.set("#38bdf8");
      else if (n.role === "relay") color.set("#a78bfa");
      else color.set("#34d399");
      mesh.setColorAt(i, color);
      i++;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  const geom = useMemo(() => new THREE.SphereGeometry(1, 14, 14), []);
  const mat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        vertexColors: true,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      geom.dispose();
      mat.dispose();
    };
  }, [geom, mat]);

  return <instancedMesh ref={meshRef} args={[geom, mat, MAX_DRONE_INSTANCES]} />;
}

function ExploredCellOverlay({ view }: { view: VertexSwarmView }) {
  const show = useMapOverlayStore((s) => s.showExploredGrid);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#38bdf8",
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      }),
    [],
  );
  const geom = useMemo(() => new THREE.BoxGeometry(0.22, 0.04, 0.22), []);

  const samples = useMemo(() => {
    const out: { gx: number; gz: number }[] = [];
    for (const [k, meta] of Object.entries(view.sharedMap.cells)) {
      if (
        meta.state === "seen" ||
        meta.state === "searched" ||
        meta.state === "safe" ||
        meta.state === "target"
      ) {
        const p = parseCellKey(k);
        if (p) out.push(p);
      }
    }
    const step = Math.max(1, Math.ceil(out.length / MAX_CELL_INSTANCES));
    return out.filter((_, idx) => idx % step === 0).slice(0, MAX_CELL_INSTANCES);
  }, [view.sharedMap.cells]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !show) return;
    let i = 0;
    for (const c of samples) {
      if (i >= MAX_CELL_INSTANCES) break;
      dummy.position.set(c.gx * 0.22, 0.06, c.gz * 0.22);
      dummy.updateMatrix();
      mesh.setMatrixAt(i++, dummy.matrix);
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  });

  useEffect(() => {
    return () => {
      geom.dispose();
      mat.dispose();
    };
  }, [geom, mat]);

  if (!show) return null;
  return <instancedMesh ref={meshRef} args={[geom, mat, MAX_CELL_INSTANCES]} />;
}

/** Translucent operational volume + edge highlight. */
function GeofenceGroup({ visible }: { visible: boolean }) {
  const geom = useMemo(() => new THREE.BoxGeometry(22, 3.5, 22), []);
  const fillMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#0ea5e9", transparent: true, opacity: 0.04, depthWrite: false }),
    [],
  );
  const edgeGeom = useMemo(() => new THREE.EdgesGeometry(geom), [geom]);
  const edgeMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.45 }),
    [],
  );
  useEffect(() => {
    return () => {
      geom.dispose();
      fillMat.dispose();
      edgeGeom.dispose();
      edgeMat.dispose();
    };
  }, [geom, fillMat, edgeGeom, edgeMat]);
  if (!visible) return null;
  return (
    <group position={[0, 1.2, 0]}>
      <mesh geometry={geom} material={fillMat} />
      <lineSegments geometry={edgeGeom} material={edgeMat} />
    </group>
  );
}

function WildfireHeatPlane({ scenario }: { scenario: string }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => THREE.UniformsUtils.clone(heatShader.uniforms), []);
  useFrame((st) => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uTime.value = st.clock.elapsedTime;
    m.uniforms.uOpacity.value = useMapOverlayStore.getState().thermalOpacity01;
  });
  if (scenario !== "wildfire") return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <planeGeometry args={[14, 14]} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        vertexShader={heatShader.vertexShader}
        fragmentShader={heatShader.fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

function FloodWaterPlane({ scenario, view }: { scenario: string; view: VertexSwarmView }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => THREE.UniformsUtils.clone(waterShader.uniforms), []);
  useFrame((st) => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uTime.value = st.clock.elapsedTime;
    const stStore = useMapOverlayStore.getState();
    m.uniforms.uOpacity.value = stStore.waterOpacity01;
    const wave = Math.sin(view.tickCount * 0.08) * 0.5 + 0.5;
    m.uniforms.uLevel.value = wave * 0.85 + stStore.waterLevelBoost01 * 0.4;
  });
  if (scenario !== "flood_rescue") return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.18, 0]}>
      <planeGeometry args={[16, 16]} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        vertexShader={waterShader.vertexShader}
        fragmentShader={waterShader.fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

function HazmatContourField({ scenario, view }: { scenario: string; view: VertexSwarmView }) {
  const intensity = useMapOverlayStore((s) => s.gasContourIntensity01);
  const samples = useMemo(() => {
    const pts: { x: number; z: number; color: string }[] = [];
    let i = 0;
    for (let gx = -8; gx <= 8; gx += 2) {
      for (let gz = -8; gz <= 8; gz += 2) {
        const tel = view.telemetry[i % Math.max(1, view.telemetry.length)];
        const stress = tel?.sensorConfidence01 ?? 0.5;
        const color = stress > 0.72 ? "#ef4444" : stress > 0.45 ? "#eab308" : "#22c55e";
        pts.push({ x: gx * 0.55, z: gz * 0.55, color });
        i++;
      }
    }
    return pts;
  }, [view.telemetry]);

  if (scenario !== "hazmat") return null;
  const scale = 0.75 + intensity * 0.55;
  return (
    <group>
      {samples.map((p, idx) => (
        <mesh key={idx} position={[p.x, 0.08, p.z]} scale={scale}>
          <boxGeometry args={[0.32, 0.05, 0.32]} />
          <meshStandardMaterial color={p.color} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function TargetMarkers({
  view,
  selectedId,
  onSelect,
  reducedMotion,
}: {
  view: VertexSwarmView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  reducedMotion: boolean;
}) {
  return (
    <group>
      {view.discovery.map((d) => {
        const active = d.candidateId === selectedId;
        const x = d.world.x * 0.08;
        const z = d.world.z * 0.08;
        const pulse = !reducedMotion ? 1 + Math.sin(performance.now() / 350) * 0.06 : 1;
        return (
          <group key={d.candidateId} position={[x, 0.35, z]}>
            <mesh
              scale={pulse * (active ? 1.25 : 1)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(active ? null : d.candidateId);
              }}
            >
              <sphereGeometry args={[0.22, 20, 20]} />
              <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" emissiveIntensity={0.6} roughness={0.35} />
            </mesh>
            {active ? (
              <Html distanceFactor={10} style={{ pointerEvents: "none" }} zIndexRange={[100, 0]}>
                <div className="rounded-md border border-red-500/40 bg-zinc-950/95 px-2 py-1 text-[10px] text-red-100 font-mono shadow-lg max-w-[200px]">
                  <div className="font-semibold">{d.candidateId}</div>
                  <div>{(d.mergedConfidence01 * 100).toFixed(0)}% conf · {d.status}</div>
                </div>
              </Html>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function Scene({
  view,
  trail,
  pulses,
  scenario,
  reducedMotion,
}: {
  view: VertexSwarmView;
  trail: THREE.Vector3[];
  pulses: Pulse[];
  scenario: string;
  reducedMotion: boolean;
}) {
  const selectedTargetId = useMapOverlayStore((s) => s.selectedTargetId);
  const setSelectedTargetId = useMapOverlayStore((s) => s.setSelectedTargetId);
  const showGeofence = useMapOverlayStore((s) => s.showGeofence);
  const explorerId = useMemo(() => view.nodes.find((n) => n.role === "explorer")?.nodeId ?? null, [view.nodes]);

  return (
    <>
      <color attach="background" args={["#050508"]} />
      <ambientLight intensity={0.38} />
      <directionalLight position={[8, 14, 6]} intensity={0.85} castShadow />
      <gridHelper args={[20, 40, "#1e293b", "#0f172a"]} position={[0, 0.01, 0]} />
      <RelayAnimatedLines view={view} />
      <PulseRings pulses={pulses} reducedMotion={reducedMotion} />
      <WildfireHeatPlane scenario={scenario} />
      <FloodWaterPlane scenario={scenario} view={view} />
      <HazmatContourField scenario={scenario} view={view} />
      <GeofenceGroup visible={showGeofence} />
      <ExploredCellOverlay view={view} />
      <InstancedDrones view={view} selectedId={explorerId} reducedMotion={reducedMotion} />
      {trail.length >= 2 ? (
        <Line points={trail} color="#38bdf8" lineWidth={2} transparent opacity={0.38} depthWrite={false} />
      ) : null}
      <TargetMarkers
        view={view}
        selectedId={selectedTargetId}
        onSelect={setSelectedTargetId}
        reducedMotion={reducedMotion}
      />
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
  const reducedMotion = usePrefersReducedMotion();

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
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11 text-xs"
          onClick={() => useMapOverlayStore.getState().setShowExploredGrid(!useMapOverlayStore.getState().showExploredGrid)}
          aria-label="Toggle explored cell overlay"
        >
          Explored grid
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11 text-xs"
          onClick={() => useMapOverlayStore.getState().setShowGeofence(!useMapOverlayStore.getState().showGeofence)}
          aria-label="Toggle operational geofence box"
        >
          Geofence
        </Button>
        <Button type="button" size="sm" variant="outline" className="min-h-11 text-xs" onClick={resetCamera} aria-label="Reset map camera">
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
          <Scene view={view} trail={trail} pulses={pulses} scenario={sc} reducedMotion={reducedMotion} />
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
        Instanced drones, relay glow, explored voxels, geofence, victim markers (click for detail), and scenario overlays.{" "}
        {reducedMotion ? "Reduced motion: pulse rings softened." : ""}
      </p>
    </div>
  );
});
