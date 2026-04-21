import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useSwarmStore } from "@/stores/swarmStore";
import type { RoverState } from "@/stores/swarmStore";

function Sector3D({
  bounds,
  opacity = 0.45,
  color,
}: {
  bounds: [number, number, number, number];
  opacity?: number;
  color: string;
}) {
  const [x1, x2, z1, z2] = bounds;
  const w = Math.max(0.01, x2 - x1);
  const h = Math.max(0.01, z2 - z1);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.06, cz]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} wireframe />
    </mesh>
  );
}

function Rover3D({
  position,
  scale = 1,
  color,
  pulse = false,
}: {
  position: [number, number, number];
  scale?: number;
  color: string;
  pulse?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);

  useFrame(({ clock }) => {
    const m = meshRef.current;
    const mat = matRef.current;
    if (!m || !mat) return;
    if (pulse) {
      mat.emissiveIntensity = 0.25 + 0.2 * Math.sin(clock.elapsedTime * 6);
    } else {
      mat.emissiveIntensity = 0;
    }
  });

  return (
    <mesh ref={meshRef} position={position} scale={Math.max(0.35, scale)}>
      <boxGeometry args={[1.2, 0.65, 0.85]} />
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={pulse ? "#334433" : "#000000"}
        metalness={0.2}
        roughness={0.45}
      />
    </mesh>
  );
}

function GlobalMapOverlay({ map }: { map: number[][] }) {
  const texture = useMemo(() => {
    const rows = map.length;
    const cols = map[0]?.length ?? 0;
    if (!rows || !cols) return null;

    const data = new Uint8Array(cols * rows * 4);
    let max = 1e-6;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        max = Math.max(max, map[y][x] ?? 0);
      }
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = (map[y][x] ?? 0) / max;
        const i = (y * cols + x) * 4;
        data[i] = Math.floor(40 + v * 200);
        data[i + 1] = Math.floor(20 + v * 180);
        data[i + 2] = Math.floor(80 + v * 120);
        data[i + 3] = Math.floor(40 + v * 180);
      }
    }
    const tex = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat);
    tex.flipY = true;
    tex.needsUpdate = true;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, [map]);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  if (!texture) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
      <planeGeometry args={[90, 90]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} opacity={0.55} />
    </mesh>
  );
}

function Scene() {
  const rovers = useSwarmStore((s) => s.rovers);
  const globalMap = useSwarmStore((s) => s.globalMap);
  const reallocated = useSwarmStore((s) => s.reallocated);

  return (
    <>
      <color attach="background" args={["#0a0a0c"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[40, 60, 20]} intensity={1.1} castShadow />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1f3d2a" roughness={0.9} metalness={0.05} />
      </mesh>

      <GlobalMapOverlay map={globalMap} />

      {rovers.map((rover: RoverState) => (
        <Sector3D
          key={`s-${rover.id}`}
          bounds={rover.sector.bounds}
          opacity={reallocated ? 0.22 : 0.5}
          color={rover.state === "dead" ? "#ff6b6b" : "#69f0ae"}
        />
      ))}

      {rovers.map((rover: RoverState) => (
        <Rover3D
          key={rover.id}
          position={rover.position}
          scale={0.35 + (rover.battery / 100) * 0.85}
          color={
            rover.state === "dead" ? "#ff4444" : reallocated ? "#7cfc00" : "#4f8cff"
          }
          pulse={reallocated && rover.state !== "dead"}
        />
      ))}

      <fog attach="fog" args={["#0a0a0c", 60, 220]} />
    </>
  );
}

export default function FallenComradeViz() {
  const time = useSwarmStore((s) => s.time);
  const reallocated = useSwarmStore((s) => s.reallocated);
  const globalMap = useSwarmStore((s) => s.globalMap);
  let liveCells = 0;
  if (globalMap.length > 0) {
    try {
      liveCells = globalMap.reduce((acc, row) => {
        if (!Array.isArray(row)) return acc;
        return acc + row.filter((c) => typeof c === "number" && Number.isFinite(c) && c > 0).length;
      }, 0);
    } catch {
      liveCells = 0;
    }
  }
  const timeLabel = Number.isFinite(time) ? time.toFixed(1) : "0.0";

  return (
    <div className="h-full min-h-0 w-full bg-gradient-to-br from-zinc-950 to-black">
      <Canvas
        className="h-full w-full"
        shadows
        camera={{ position: [55, 42, 55], fov: 55, near: 0.1, far: 500 }}
        dpr={[1, 2]}
      >
        <Scene />
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-24 font-mono text-sm text-white drop-shadow-md">
        <div>T+{timeLabel}s</div>
        <div>Reallocated: {reallocated ? "yes" : "no"}</div>
        <div>Live cells: {liveCells}</div>
      </div>
    </div>
  );
}
