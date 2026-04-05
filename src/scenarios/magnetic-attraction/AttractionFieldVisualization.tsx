import { useMagneticAttractionStore } from "./magneticAttractionStore";

/** Subtle pulse ring at the highest-value victim (consensus focal point). */
export default function AttractionFieldVisualization() {
  const victims = useMagneticAttractionStore((s) => s.victims);
  const focus = victims.reduce((a, b) => (a.value >= b.value ? a : b));

  return (
    <group position={[focus.x, 0.05, focus.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6, 8.5, 48]} />
        <meshBasicMaterial color={focus.color} transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </group>
  );
}
