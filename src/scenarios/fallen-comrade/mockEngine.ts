import type { RoverState } from "@/stores/swarmStore";
import { ROVER_IDS, type Bounds, type FallenTrack2Frame } from "./types";
import { reallocateDeadSector } from "./reallocation";

const GRID = 100;
const STOP_HB_B = 30;
const STOP_HB_C = 120;
const HB_TIMEOUT = 3;

type InternalRover = {
  id: string;
  position: [number, number, number];
  battery: number;
  state: RoverState["state"];
  sector: { bounds: Bounds };
  heartbeat: number;
  exploredCells: Set<string>;
  targetX?: number;
  targetZ?: number;
};

function sectorCenter(b: Bounds): [number, number, number] {
  return [(b[0] + b[1]) / 2, 0.5, (b[2] + b[3]) / 2];
}

function initialSectors(): Record<string, Bounds> {
  const out: Record<string, Bounds> = {};
  ROVER_IDS.forEach((id, i) => {
    const x0 = i * 20;
    out[id] = [x0, x0 + 20, 0, 20];
  });
  return out;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function placeObstacles(grid: number[][], rng: () => number) {
  const stamp = (cx: number, cz: number, w: number, h: number) => {
    const x0 = Math.max(0, cx - Math.floor(w / 2));
    const z0 = Math.max(0, cz - Math.floor(h / 2));
    for (let z = z0; z < Math.min(GRID, z0 + h); z++) {
      for (let x = x0; x < Math.min(GRID, x0 + w); x++) {
        grid[z]![x] = 1;
      }
    }
  };
  stamp(Math.floor(GRID / 2), Math.floor(GRID / 2), 14, 6);
  stamp(Math.floor(GRID / 2) + 8, Math.floor(GRID / 2) - 5, 8, 10);
  stamp(Math.floor(GRID / 3), Math.floor((2 * GRID) / 3), 10, 8);
  for (let k = 0; k < 3; k++) {
    stamp(
      10 + Math.floor(rng() * (GRID - 20)),
      10 + Math.floor(rng() * (GRID - 20)),
      3 + Math.floor(rng() * 5),
      3 + Math.floor(rng() * 5),
    );
  }
}

function toPublicRover(r: InternalRover): RoverState {
  return {
    id: r.id,
    position: [...r.position] as [number, number, number],
    battery: r.battery,
    state: r.state,
    sector: { bounds: [...r.sector.bounds] as [number, number, number, number] },
  };
}

export class FallenComradeMockEngine {
  readonly seed: number;
  t = 0;
  grid: number[][];
  initialSectorBounds: Record<string, Bounds>;
  rovers: InternalRover[];
  reallocated = false;
  private rng: () => number;
  private bDead = false;
  private cDead = false;
  private foxCells = new Set<string>();

  constructor(seed = 42) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.grid = Array.from({ length: GRID }, () => Array<number>(GRID).fill(0));
    placeObstacles(this.grid, this.rng);
    this.initialSectorBounds = initialSectors();
    this.rovers = ROVER_IDS.map((id) => {
      const b = this.initialSectorBounds[id]!;
      return {
        id,
        position: sectorCenter(b),
        battery: 100,
        state: "exploring",
        sector: { bounds: [...b] as Bounds },
        heartbeat: 0,
        exploredCells: new Set<string>(),
      };
    });
  }

  private boundsMap(): Record<string, Bounds> {
    const o: Record<string, Bounds> = {};
    for (const r of this.rovers) {
      o[r.id] = r.sector.bounds;
    }
    return o;
  }

  private survivors(): InternalRover[] {
    return this.rovers.filter((r) => r.state !== "dead");
  }

  private heartbeatStale(r: InternalRover): boolean {
    if (r.state === "dead") return false;
    return this.t - r.heartbeat > HB_TIMEOUT;
  }

  private maybeKill(r: InternalRover) {
    if (r.state === "dead") return;
    if (this.heartbeatStale(r)) {
      r.state = "dead";
      r.battery = 0;
    }
  }

  private reallocateFor(deadId: string, deadBounds: Bounds) {
    const surv = this.survivors().filter((r) => r.id !== deadId);
    const ids = surv.map((r) => r.id);
    if (!ids.length) return;
    const next = reallocateDeadSector(deadBounds, ids, this.boundsMap());
    for (const s of surv) {
      const nb = next[s.id];
      if (nb) s.sector = { bounds: [...nb] as Bounds };
      s.state = "reallocating";
    }
    this.reallocated = true;
  }

  private markExplored(r: InternalRover) {
    const [px, , pz] = r.position;
    const gx = Math.round(px - 0.5);
    const gz = Math.round(pz - 0.5);
    for (let oz = -1; oz <= 1; oz++) {
      for (let ox = -1; ox <= 1; ox++) {
        const cx = gx + ox;
        const cz = gz + oz;
        if (cx >= 0 && cx < GRID && cz >= 0 && cz < GRID) {
          r.exploredCells.add(`${cx},${cz}`);
          this.foxCells.add(`${cx},${cz}`);
        }
      }
    }
  }

  step(dt: number): FallenTrack2Frame {
    this.t += dt;
    const bDeadBounds = this.initialSectorBounds["RoverB"]!;

    for (const r of this.rovers) {
      if (r.state === "dead") continue;
      const stopHb =
        (r.id === "RoverB" && this.t >= STOP_HB_B) || (r.id === "RoverC" && this.t >= STOP_HB_C);
      if (stopHb) {
        if (r.id === "RoverB" && !this.bDead) this.maybeKill(r);
        if (r.id === "RoverC" && !this.cDead) this.maybeKill(r);
        continue;
      }
      if (r.state === "reallocating") r.state = "exploring";
      r.heartbeat = this.t;
      const b = r.sector.bounds;
      const [xmin, xmax, zmin, zmax] = b;
      const speed = 1.2;
      let tx = r.targetX;
      let tz = r.targetZ;
      if (tx == null || tz == null) {
        const u = this.rng();
        const v = this.rng();
        tx = xmin + 2 + u * Math.max(0.1, xmax - xmin - 4);
        tz = zmin + 2 + v * Math.max(0.1, zmax - zmin - 4);
        r.targetX = tx;
        r.targetZ = tz;
      }
      const [px, py, pz] = r.position;
      const dx = tx! - px;
      const dz = tz! - pz;
      const dist = Math.hypot(dx, dz) || 1e-6;
      const stepM = Math.min(speed * dt, dist);
      r.position = [px + (dx / dist) * stepM, py, pz + (dz / dist) * stepM];
      if (dist < 0.75) {
        r.targetX = undefined;
        r.targetZ = undefined;
      }
      r.battery = Math.max(0, r.battery - 0.02 * dt * (0.4 + 0.1 * Math.sin(this.t)));
      this.markExplored(r);
    }

    const rb = this.rovers.find((x) => x.id === "RoverB");
    if (rb && !this.bDead && rb.state === "dead") {
      this.bDead = true;
      this.reallocateFor("RoverB", bDeadBounds);
    }

    const rc = this.rovers.find((x) => x.id === "RoverC");
    if (rc && this.bDead && !this.cDead && rc.state === "dead") {
      this.cDead = true;
      this.reallocateFor("RoverC", rc.sector.bounds);
    }

    return {
      time: this.t,
      global_map: this.renderGlobalMap(),
      reallocated: this.reallocated,
      rovers: this.rovers.map(toPublicRover),
    };
  }

  private renderGlobalMap(): number[][] {
    const m: number[][] = Array.from({ length: GRID }, () => Array<number>(GRID).fill(0));
    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (this.grid[z]![x]) m[z]![x] = 1;
      }
    }
    for (const key of this.foxCells) {
      const [sx, sz] = key.split(",").map(Number);
      if (sx >= 0 && sx < GRID && sz >= 0 && sz < GRID && !this.grid[sz]![sx]) {
        m[sz]![sx] = Math.max(m[sz]![sx]!, 1.5);
      }
    }
    for (const r of this.rovers) {
      if (r.state === "dead") continue;
      const tint = 2 + 0.4 * (r.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 5);
      for (const key of r.exploredCells) {
        const [sx, sz] = key.split(",").map(Number);
        if (sx >= 0 && sx < GRID && sz >= 0 && sz < GRID && !this.grid[sz]![sx]) {
          m[sz]![sx] = Math.max(m[sz]![sx]!, Math.min(6, tint));
        }
      }
    }
    return m;
  }
}
