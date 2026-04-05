export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface AgentLite {
  pos: Vec3;
  vel: Vec3;
}

export interface Shelf {
  min: Vec3;
  max: Vec3;
}

function dist(a: Vec3, b: Vec3) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Straight-line pull toward target (stand-in for dynamic A*). */
function directToward(agent: Vec3, target: Vec3, step: number): Vec3 {
  const d = dist(agent, target);
  if (d < 1e-6) return { x: 0, y: 0, z: 0 };
  const ux = (target.x - agent.x) / d;
  const uy = (target.y - agent.y) / d;
  const uz = (target.z - agent.z) / d;
  return { x: ux * step, y: uy * step, z: uz * step };
}

/** Simple boids separation from nearby agents. */
function boidsFlocking(self: Vec3, nearby: AgentLite[], weight: number): Vec3 {
  let fx = 0,
    fy = 0,
    fz = 0;
  for (const o of nearby) {
    const dx = self.x - o.pos.x;
    const dy = self.y - o.pos.y;
    const dz = self.z - o.pos.z;
    const d = Math.hypot(dx, dy, dz) + 1e-6;
    if (d < 4) {
      fx += (dx / d) * weight;
      fy += (dy / d) * weight;
      fz += (dz / d) * weight;
    }
  }
  return { x: fx, y: fy, z: fz };
}

/** Mild right-hand bias to mimic lane preference (traffic field). */
function laneOptimization(agent: Vec3, target: Vec3): Vec3 {
  const dx = target.x - agent.x;
  const dz = target.z - agent.z;
  return { x: -dz * 0.02, y: 0, z: dx * 0.02 };
}

export function weightedCombine(vectors: Vec3[], weights: number[]): Vec3 {
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const out = { x: 0, y: 0, z: 0 };
  vectors.forEach((v, i) => {
    const w = weights[i] ?? 0;
    out.x += v.x * w;
    out.y += v.y * w;
    out.z += v.z * w;
  });
  out.x /= wsum;
  out.y /= wsum;
  out.z /= wsum;
  return out;
}

/**
 * Emergent planner: direct goal pursuit + light flocking + lane bias.
 * Weights follow the brief: 0.6 / 0.25 / 0.15.
 */
export function emergentPathfinder(agent: AgentLite, nearby: AgentLite[], _shelves: Shelf[], target: Vec3, step = 0.15): Vec3 {
  const direct = directToward(agent.pos, target, step);
  const flock = boidsFlocking(
    agent.pos,
    nearby.filter((n) => dist(n.pos, agent.pos) > 0.05),
    0.08,
  );
  const traffic = laneOptimization(agent.pos, target);
  return weightedCombine([direct, flock, traffic], [0.6, 0.25, 0.15]);
}

/** Samples a polyline for SVG / Recharts overlays. */
export function sampleEmergentPath(
  start: Vec3,
  target: Vec3,
  neighbors: AgentLite[],
  shelves: Shelf[],
  steps = 32,
): Vec3[] {
  const pts: Vec3[] = [{ ...start }];
  let cur: AgentLite = { pos: { ...start }, vel: { x: 0, y: 0, z: 0 } };
  for (let i = 0; i < steps; i++) {
    const localNeighbors = neighbors.filter((n) => dist(n.pos, cur.pos) > 0.05);
    const delta = emergentPathfinder(cur, localNeighbors, shelves, target, 0.22);
    cur = {
      pos: { x: cur.pos.x + delta.x, y: cur.pos.y + delta.y, z: cur.pos.z + delta.z },
      vel: delta,
    };
    pts.push({ ...cur.pos });
    if (dist(cur.pos, target) < 0.35) break;
  }
  return pts;
}
