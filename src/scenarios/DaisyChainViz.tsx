import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { useSwarmStore } from "@/stores/swarmStore";

function RelayScene() {
  const chain = useSwarmStore((s) => s.relayChain);
  const depth = useSwarmStore((s) => s.tunnelDepth);
  const signal = useSwarmStore((s) => s.signalQuality);

  const positions = useMemo(() => {
    const n = Math.max(chain.length, 1);
    const span = 24;
    return chain.map((_, i) => {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      return new THREE.Vector3(t * span, 1.2 + Math.sin(i * 0.7) * 0.35, -depth * 0.15);
    });
  }, [chain, depth]);

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

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 6]}>
        <planeGeometry args={[140, 80]} />
        <meshStandardMaterial color="#1b1b1f" roughness={0.95} metalness={0.02} />
      </mesh>

      <mesh position={[0, 4, -18]} rotation={[0, 0, 0]}>
        <boxGeometry args={[10, 8, 26]} />
        <meshStandardMaterial color="#2a2a30" roughness={0.88} metalness={0.05} />
      </mesh>

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

  return (
    <div className="relative h-full min-h-0 w-full bg-gradient-to-br from-zinc-950 to-violet-950/30">
      <Canvas
        className="h-full w-full"
        shadows
        camera={{ position: [32, 22, 38], fov: 50 }}
        dpr={[1, 2]}
      >
        <RelayScene />
      </Canvas>

      <div className="pointer-events-none absolute right-4 top-24 w-64 rounded-lg border border-border/60 bg-black/55 p-3 font-mono text-xs text-white backdrop-blur">
        <div className="text-[11px] text-violet-200">Tunnel depth</div>
        <div className="text-xl font-bold">{tunnelDepth.toFixed(1)} m</div>
        <div className="mt-3 text-[11px] text-violet-200">Relay hops</div>
        <div>{relayChain.length ? relayChain.join(" → ") : "waiting for stream…"}</div>
        <div className="mt-3 text-[11px] text-violet-200">Signal (sample)</div>
        <div className="max-h-28 space-y-1 overflow-auto text-[10px] text-slate-300">
          {Object.keys(signalQuality).length === 0 ? (
            <span className="text-muted-foreground">No signal_quality keys yet</span>
          ) : (
            Object.entries(signalQuality).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="truncate">{k}</span>
                <span>{v.toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
