import * as THREE from "three";

export type WarehouseObstacle = {
  id: string;
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  height: number;
  color: string;
};

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateWarehouseObstacles(seed: number, difficulty: number): WarehouseObstacle[] {
  const rand = mulberry32(seed);
  const obstacles: WarehouseObstacle[] = [];
  const palletN = 10 + Math.floor(difficulty * 4);
  const shelfN = 6 + Math.floor(difficulty * 2);

  for (let i = 0; i < palletN; i++) {
    const x = (rand() - 0.5) * 76;
    const z = (rand() - 0.5) * 48;
    if (Math.abs(x - -42) < 10 && Math.abs(z) < 12) continue;
    if (Math.abs(x - 42) < 10 && Math.abs(z) < 14) continue;
    obstacles.push({
      id: `pallet-${i}`,
      x,
      z,
      halfW: 2 + rand() * 0.6,
      halfD: 3 + rand(),
      height: 1.8 + rand() * 0.4,
      color: new THREE.Color().setHSL(0.08 + rand() * 0.06, 0.55 + rand() * 0.2, 0.45 + rand() * 0.15).getStyle(),
    });
  }

  for (let i = 0; i < shelfN; i++) {
    const x = ((i % 3) - 1) * 22 + (rand() - 0.5) * 6;
    const z = Math.floor(i / 3) * 18 - 18 + (rand() - 0.5) * 4;
    obstacles.push({
      id: `shelf-${i}`,
      x,
      z,
      halfW: 1.6,
      halfD: 6,
      height: 7.5,
      color: "#4b5563",
    });
  }

  return obstacles;
}

const GRID = 48;
const WORLD = 96;

function worldToGrid(x: number, z: number): { gx: number; gz: number } {
  const gx = Math.floor(((x + WORLD / 2) / WORLD) * GRID);
  const gz = Math.floor(((z + WORLD / 2) / WORLD) * GRID);
  return {
    gx: Math.max(0, Math.min(GRID - 1, gx)),
    gz: Math.max(0, Math.min(GRID - 1, gz)),
  };
}

function buildOccupancy(obstacles: WarehouseObstacle[]): boolean[][] {
  const occ: boolean[][] = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  const pad = 1.2;
  for (const o of obstacles) {
    const minX = o.x - o.halfW - pad;
    const maxX = o.x + o.halfW + pad;
    const minZ = o.z - o.halfD - pad;
    const maxZ = o.z + o.halfD + pad;
    for (let gx = 0; gx < GRID; gx++) {
      for (let gz = 0; gz < GRID; gz++) {
        const wx = (gx / GRID) * WORLD - WORLD / 2 + WORLD / GRID / 2;
        const wz = (gz / GRID) * WORLD - WORLD / 2 + WORLD / GRID / 2;
        if (wx >= minX && wx <= maxX && wz >= minZ && wz <= maxZ) occ[gx][gz] = true;
      }
    }
  }
  return occ;
}

type Node = { gx: number; gz: number; g: number; f: number; parent: Node | null };

function astarLength(occ: boolean[][], startGx: number, startGz: number, goalGx: number, goalGz: number): number {
  const key = (gx: number, gz: number) => gx * GRID + gz;
  const h = (gx: number, gz: number) => Math.abs(gx - goalGx) + Math.abs(gz - goalGz);

  const open: Node[] = [];
  const closed = new Set<number>();

  const start: Node = { gx: startGx, gz: startGz, g: 0, f: h(startGx, startGz), parent: null };
  open.push(start);

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    const ck = key(cur.gx, cur.gz);
    if (closed.has(ck)) continue;
    closed.add(ck);

    if (cur.gx === goalGx && cur.gz === goalGz) {
      let len = 0;
      let p: Node | null = cur;
      while (p?.parent) {
        len++;
        p = p.parent;
      }
      return Math.max(1, len);
    }

    const neigh = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const;
    for (const [dx, dz] of neigh) {
      const ngx = cur.gx + dx;
      const ngz = cur.gz + dz;
      if (ngx < 0 || ngx >= GRID || ngz < 0 || ngz >= GRID) continue;
      if (occ[ngx][ngz]) continue;
      const nk = key(ngx, ngz);
      if (closed.has(nk)) continue;
      const g = cur.g + 1;
      const f = g + h(ngx, ngz);
      open.push({ gx: ngx, gz: ngz, g, f, parent: cur });
    }
  }
  return 60;
}

export function estimateAStarBaselineSeconds(
  obstacles: WarehouseObstacle[],
  seed: number,
  difficulty: number,
): number {
  const occ = buildOccupancy(obstacles);
  const start = worldToGrid(-42, 0);
  const goal = worldToGrid(42, 0);
  if (occ[start.gx][start.gz]) occ[start.gx][start.gz] = false;
  if (occ[goal.gx][goal.gz]) occ[goal.gx][goal.gz] = false;

  const steps = astarLength(occ, start.gx, start.gz, goal.gx, goal.gz);
  const secPerStep = 0.11 + difficulty * 0.035;
  const replanPenalty = 1.18 + (seed % 7) * 0.01;
  return steps * secPerStep * replanPenalty;
}
