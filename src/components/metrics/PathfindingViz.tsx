import { useMemo } from "react";
import { useSwarmStore } from "@/store/swarmStore";
import { sampleEmergentPath, type AgentLite, type Shelf } from "@/lib/pathfinding/emergentPath";

const MOCK_SHELVES: Shelf[] = [
  { min: { x: -6, y: 0, z: -2 }, max: { x: -4, y: 3, z: 8 } },
  { min: { x: 4, y: 0, z: -4 }, max: { x: 7, y: 3, z: 2 } },
];

/** Top-down projection of emergent path vs straight baseline (D3-style polyline in SVG). */
export default function PathfindingViz() {
  const agents = useSwarmStore((s) => s.agents);

  const { pathD, baselineD, w, h } = useMemo(() => {
    const leader = agents.find((a) => a.role === "explorer") ?? agents[0];
    if (!leader) return { pathD: "", baselineD: "", w: 200, h: 200 };
    const target = { x: 8, y: 0, z: 6 };
    const start = { x: leader.position.x, y: leader.position.y, z: leader.position.z };
    const neighbors: AgentLite[] = agents.map((a) => ({
      pos: { x: a.position.x, y: a.position.y, z: a.position.z },
      vel: { x: 0, y: 0, z: 0 },
    }));
    const pts = sampleEmergentPath(start, target, neighbors, MOCK_SHELVES, 40);
    const pad = 12;
    const xs = pts.map((p) => p.x);
    const zs = pts.map((p) => p.z);
    const minX = Math.min(...xs, target.x) - 2;
    const maxX = Math.max(...xs, target.x) + 2;
    const minZ = Math.min(...zs, target.z) - 2;
    const maxZ = Math.max(...zs, target.z) + 2;
    const bw = maxX - minX || 1;
    const bh = maxZ - minZ || 1;
    const W = 220;
    const H = 160;
    const project = (x: number, z: number) => {
      const px = pad + ((x - minX) / bw) * (W - pad * 2);
      const py = pad + ((z - minZ) / bh) * (H - pad * 2);
      return [px, H - py] as const;
    };
    const pathD = pts
      .map((p, i) => {
        const [px, py] = project(p.x, p.z);
        return `${i === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`;
      })
      .join(" ");
    const [bx0, by0] = project(start.x, start.z);
    const [bx1, by1] = project(target.x, target.z);
    const baselineD = `M ${bx0.toFixed(1)} ${by0.toFixed(1)} L ${bx1.toFixed(1)} ${by1.toFixed(1)}`;
    return { pathD, baselineD, w: W, h: H };
  }, [agents]);

  return (
    <div className="rounded-xl border border-border/80 bg-card/40 p-3 backdrop-blur-sm">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Pathfinding viz</p>
      <p className="mb-2 text-xs text-muted-foreground leading-snug">
        Emergent blend (0.6 direct · 0.25 flock · 0.15 lanes) vs straight baseline.
      </p>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="pf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(185 80% 50%)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(270 70% 55%)" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={w} height={h} rx="10" className="fill-muted/30" />
        <path d={baselineD} fill="none" stroke="hsl(215 15% 40%)" strokeWidth="1.5" strokeDasharray="4 3" />
        <path d={pathD} fill="none" stroke="url(#pf-grad)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
