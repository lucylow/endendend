export function Aerial3D({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} castShadow>
      <coneGeometry args={[0.9, 2.2, 8]} />
      <meshStandardMaterial color="#42a5f5" metalness={0.25} roughness={0.35} />
    </mesh>
  );
}
