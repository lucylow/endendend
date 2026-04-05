import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useMemo } from "react";
import { useWarehouseRestockStore } from "@/store/warehouseRestockStore";

const boxColor = (hue: number, j: number) =>
  new THREE.Color().setHSL((hue + j * 0.04) % 1, 0.78, 0.52);

export default function WarehouseEnvironment() {
  const shelves = useWarehouseRestockStore((s) => s.shelves);

  const zones = useMemo(() => [-35, 35] as const, []);

  return (
    <group>
      <ambientLight intensity={0.38} />
      <hemisphereLight args={["#d4e8ff", "#2a2418", 0.45]} />
      <directionalLight
        castShadow
        position={[45, 58, 28]}
        intensity={1.05}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={140}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <planeGeometry args={[120, 100]} />
        <meshLambertMaterial color="#e8eef5" />
      </mesh>

      {shelves.map((shelf) => (
        <group key={shelf.index} position={[shelf.x, 0, shelf.z]}>
          <mesh castShadow receiveShadow position={[0, 6, 0]}>
            <boxGeometry args={[16, 12, 4]} />
            <meshStandardMaterial color="#3f6212" metalness={0.12} roughness={0.82} />
          </mesh>
          {Array.from({ length: shelf.inventory }).map((_, j) => (
            <mesh
              key={`${shelf.index}-${j}`}
              castShadow
              position={[(j - shelf.inventory / 2) * 1.15, 12.2, Math.sin(j * 0.7) * 0.45]}
            >
              <boxGeometry args={[1.05, 1.05, 1.05]} />
              <meshStandardMaterial color={boxColor(shelf.hue, j)} emissive={boxColor(shelf.hue, j)} emissiveIntensity={0.08} />
            </mesh>
          ))}
        </group>
      ))}

      {zones.map((x, i) => (
        <group key={x} position={[x, 0, -40]}>
          <mesh castShadow position={[0, 3, 0]}>
            <cylinderGeometry args={[3, 3, 6, 28]} />
            <meshStandardMaterial color="#059669" emissive="#059669" emissiveIntensity={0.55} />
          </mesh>
          <Html position={[0, 7.2, 0]} center className="pointer-events-none select-none">
            <span className="rounded-md bg-emerald-950/90 px-2 py-1 text-[10px] font-bold tracking-wide text-emerald-300 shadow-lg ring-1 ring-emerald-500/40">
              RESTOCK {i + 1}
            </span>
          </Html>
        </group>
      ))}
    </group>
  );
}
