import { Suspense, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Trail } from "@react-three/drei";
import * as THREE from "three";
import { useSwarmStore } from "@/store/swarmStore";
import type { Position } from "@/types";

const _v3a = new THREE.Vector3();
const _v3b = new THREE.Vector3();

/* ─── smooth-interpolated drone ─── */
function Drone({
  position,
  trajectory,
  color,
  role,
  status,
  animate,
}: {
  position: [number, number, number];
  trajectory: Position[];
  color: string;
  role: string;
  status: string;
  animate: boolean;
}) {
  const ref = useRef<THREE.Group>(null!);
  const trailRef = useRef<THREE.Mesh>(null!);
  const emissive = useMemo(() => new THREE.Color(color), [color]);
  const isOffline = status === "offline";
  const lerpSpeed = 4; // units per second for smooth catch-up

  // store current interpolated target
  const target = useRef(new THREE.Vector3(...position));
  const propellerRefs = useRef<(THREE.Mesh | null)[]>([]);

  // update target whenever store position changes
  target.current.set(...position);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const g = ref.current;

    if (animate) {
      // lerp toward target position
      g.position.lerp(target.current, 1 - Math.exp(-lerpSpeed * delta));
      // hover bob on top of interpolated y
      g.position.y += Math.sin(Date.now() * 0.003 + position[0] * 2) * 0.12;
      // face direction of travel
      _v3a.copy(target.current).sub(g.position);
      if (_v3a.lengthSq() > 0.001) {
        const yaw = Math.atan2(_v3a.x, _v3a.z);
        g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, yaw, 1 - Math.exp(-3 * delta));
      }
      // spin propellers
      propellerRefs.current.forEach((m) => {
        if (m) m.rotation.y += delta * 25;
      });
    } else {
      g.position.set(...position);
    }
  });

  return (
    <group ref={ref} position={position}>
      {/* trail ribbon */}
      {animate && !isOffline && (
        <Trail
          width={0.6}
          length={6}
          color={new THREE.Color(color)}
          attenuation={(t) => t * t}
          target={trailRef}
        />
      )}

      {/* body */}
      <mesh ref={trailRef} castShadow>
        <octahedronGeometry args={[0.35, 0]} />
        <meshStandardMaterial
          color={isOffline ? "#444" : color}
          emissive={isOffline ? "#000" : emissive}
          emissiveIntensity={isOffline ? 0 : 0.6}
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>

      {/* propeller discs – 4 spinning elements */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
        <mesh
          key={i}
          ref={(el) => { propellerRefs.current[i] = el; }}
          position={[Math.cos(angle) * 0.45, 0.18, Math.sin(angle) * 0.45]}
        >
          <cylinderGeometry args={[0.18, 0.18, 0.015, 8]} />
          <meshStandardMaterial
            color={isOffline ? "#333" : "#8af"}
            transparent
            opacity={animate ? 0.45 : 0.7}
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>
      ))}

      {/* role ring for explorer */}
      {role === "explorer" && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.03, 8, 24]} />
          <meshStandardMaterial
            color="#00d4ff"
            emissive="#00d4ff"
            emissiveIntensity={1.2}
            transparent
            opacity={0.6}
          />
        </mesh>
      )}

      {/* relay ring */}
      {role === "relay" && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.48, 0.02, 8, 24]} />
          <meshStandardMaterial
            color="#6366f1"
            emissive="#6366f1"
            emissiveIntensity={0.8}
            transparent
            opacity={0.5}
          />
        </mesh>
      )}

      {/* point light glow */}
      {!isOffline && (
        <pointLight color={color} intensity={0.8} distance={4} decay={2} />
      )}
    </group>
  );
}

/* ─── trajectory path line ─── */
function TrajectoryPath({ trajectory, color }: { trajectory: Position[]; color: string }) {
  const points = useMemo(() => {
    if (trajectory.length < 2) return null;
    // take last 60 points for performance
    const slice = trajectory.slice(-60);
    return slice.map((p) => new THREE.Vector3(p.x, p.y + 0.05, p.z));
  }, [trajectory]);

  const geometry = useMemo(() => {
    if (!points) return null;
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  if (!geometry || !points) return null;

  return (
    <line>
      <bufferGeometry attach="geometry" {...geometry} />
      <lineBasicMaterial attach="material" color={color} transparent opacity={0.25} linewidth={1} />
    </line>
  );
}

/* ─── relay chain links ─── */
function RelayLinks({ agents, animate }: { agents: { id: string; position: Position; role: string }[]; animate: boolean }) {
  const relays = useMemo(
    () => agents.filter((a) => a.role === "relay" || a.role === "explorer"),
    [agents],
  );

  const points = useMemo(
    () => relays.map((a) => new THREE.Vector3(a.position.x, a.position.y + 0.2, a.position.z)),
    [relays],
  );
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  if (relays.length < 2) return null;

  return (
    <line>
      <bufferGeometry attach="geometry" {...geometry} />
      <lineBasicMaterial attach="material" color="#6366f1" transparent opacity={animate ? 0.6 : 0.3} linewidth={1} />
    </line>
  );
}

/* ─── tunnel floor ─── */
function TunnelWalls() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#0d1117" metalness={0.2} roughness={0.9} />
      </mesh>
      <Grid
        args={[30, 30]}
        position={[0, -0.49, 0]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#1a2332"
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor="#1e3a5f"
        fadeDistance={25}
        infiniteGrid={false}
      />
    </group>
  );
}

/* ─── ambient particles ─── */
function Particles({ count = 80 }: { count?: number }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 24;
      arr[i * 3 + 1] = Math.random() * 6;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    return arr;
  }, [count]);

  const ref = useRef<THREE.Points>(null!);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#00d4ff" size={0.04} transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

/* ─── inner scene ─── */
function Scene({ animate }: { animate: boolean }) {
  const agents = useSwarmStore((s) => s.agents);

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[8, 12, 5]} intensity={0.6} castShadow />
      <pointLight position={[0, 6, 0]} intensity={0.3} color="#00d4ff" />

      <TunnelWalls />
      <Particles />

      {agents.map((agent) => (
        <group key={agent.id}>
          <Drone
            position={[agent.position.x, agent.position.y, agent.position.z]}
            trajectory={agent.trajectory}
            color={agent.color}
            role={agent.role}
            status={agent.status}
            animate={animate}
          />
          {animate && agent.trajectory.length > 2 && (
            <TrajectoryPath trajectory={agent.trajectory} color={agent.color} />
          )}
        </group>
      ))}

      <RelayLinks agents={agents} animate={animate} />

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        autoRotate={animate}
        autoRotateSpeed={0.4}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={4}
        maxDistance={30}
      />
    </>
  );
}

/* ─── minimap overlay ─── */
function Minimap() {
  const agents = useSwarmStore((s) => s.agents);
  const size = 120;
  const scale = size / 30; // 30 = world extent

  return (
    <div
      className="absolute bottom-3 right-3 z-10 rounded-lg border border-border/60 bg-card/80 backdrop-blur-sm"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* grid lines */}
        {[...Array(7)].map((_, i) => {
          const v = (i * size) / 6;
          return (
            <g key={i} opacity={0.15}>
              <line x1={v} y1={0} x2={v} y2={size} stroke="hsl(var(--muted-foreground))" strokeWidth={0.5} />
              <line x1={0} y1={v} x2={size} y2={v} stroke="hsl(var(--muted-foreground))" strokeWidth={0.5} />
            </g>
          );
        })}
        {/* agents */}
        {agents.map((a) => {
          const cx = (a.position.x + 15) * scale;
          const cy = (a.position.z + 15) * scale;
          return (
            <g key={a.id}>
              {a.role === "explorer" && (
                <circle cx={cx} cy={cy} r={6} fill={a.color} opacity={0.15} />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={a.status === "offline" ? 2 : 3}
                fill={a.status === "offline" ? "#555" : a.color}
              />
            </g>
          );
        })}
      </svg>
      <span className="absolute top-1 left-1.5 font-mono text-[8px] text-muted-foreground/70">MAP</span>
    </div>
  );
}

/* ─── exported component ─── */
export default function SwarmScene({
  className,
  animate = true,
}: {
  className?: string;
  animate?: boolean;
}) {
  return (
    <div className={`bg-background relative ${className ?? ""}`}>
      <Canvas
        shadows
        camera={{ position: [12, 8, 12], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 1.5]}
        style={{ background: "transparent" }}
      >
        <color attach="background" args={["#080d14"]} />
        <fog attach="fog" args={["#080d14", 18, 35]} />
        <Suspense fallback={null}>
          <Scene animate={animate} />
        </Suspense>
      </Canvas>
      <Minimap />
    </div>
  );
}
