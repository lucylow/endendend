import type { RoverState } from "@/stores/swarmStore";
import { ROVER_IDS, type Bounds, type FallenTrack2Frame } from "./types";
import { reallocateDeadSector } from "./reallocation";

const GRID = 100;
const COMM_LOSS_B = 27;
const COMM_LOSS_C = 117;
const HB_TIMEOUT = 3;

type VictimRow = { id: string; x: number; z: number; severity: number; discovered: boolean };

type InternalRover = {
  id: string;
  position: [number, number, number];
  battery: number;
  state: RoverState["state"];
  sector: { bounds: Bounds };
  heartbeat: number;
  exploredCells: Set<string>;
  assignedVictims: string[];
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
  for (let x = 38; x < 62; x++) {
    for (let z = 45; z < 55; z++) {
      grid[z]![x] = 1;
    }
  }
  const stamp = (cx: number, cz: number, w: number, h: number) => {
    const x0 = Math.max(0, cx - Math.floor(w / 2));
    const z0 = Math.max(0, cz - Math.floor(h / 2));
    for (let z = z0; z < Math.min(GRID, z0 + h); z++) {
      for (let x = x0; x < Math.min(GRID, x0 + w); x++) {
        if (grid[z]![x] === 0) grid[z]![x] = 1;
      }
    }
  };
  stamp(Math.floor(GRID / 3), Math.floor((2 * GRID) / 3), 8, 6);
  for (let k = 0; k < 3; k++) {
    stamp(
      10 + Math.floor(rng() * (GRID - 20)),
      10 + Math.floor(rng() * (GRID - 20)),
      3 + Math.floor(rng() * 5),
      3 + Math.floor(rng() * 5),
    );
  }
}

function obstacleListFromGrid(grid: number[][]): Array<{ x: number; z: number; type: string }> {
  const out: Array<{ x: number; z: number; type: string }> = [];
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      if (grid[z]![x]) {
        const inCorridor = x >= 38 && x < 62 && z >= 45 && z < 55;
        out.push({ x, z, type: inCorridor ? "collapse" : "rubble" });
      }
    }
  }
  return out;
}

function toPublicRover(r: InternalRover, simT: number): RoverState {
  const telTask = r.state === "dead" ? "offline" : r.state === "reallocating" ? "reallocating" : "patrol";
  return {
    id: r.id,
    position: [...r.position] as [number, number, number],
    battery: r.battery,
    state: r.state,
    sector: { bounds: [...r.sector.bounds] as [number, number, number, number] },
    telemetry: {
      speed_mps: 1.2,
      heartbeat_age_s: Math.max(0, simT - r.heartbeat),
      explored_unique_cells: r.exploredCells.size,
      task: telTask,
      assigned_victims: [...r.assignedVictims],
    },
  };
}

export class FallenComradeMockEngine {
  readonly seed: number;
  t = 0;
  grid: number[][];
  initialSectorBounds: Record<string, Bounds>;
  rovers: InternalRover[];
  victims: VictimRow[];
  obstacles: Array<{ x: number; z: number; type: string }>;
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
    const obsAll = obstacleListFromGrid(this.grid);
    this.obstacles = obsAll.length > 600 ? obsAll.slice(0, 600) : obsAll;
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
        assignedVictims: [],
      };
    });
    this.victims = [];
    const free: [number, number][] = [];
    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (this.grid[z]![x] === 0) free.push([x, z]);
      }
    }
    for (let i = free.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const tmp = free[i]!;
      free[i] = free[j]!;
      free[j] = tmp;
    }
    const count = Math.min(8 + Math.floor(this.rng() * 5), free.length);
    for (let i = 0; i < count; i++) {
      const [x, z] = free[i]!;
      const row: VictimRow = {
        id: `victim_${i + 1}`,
        x: x + 0.5,
        z: z + 0.5,
        severity: 1 + Math.floor(this.rng() * 4),
        discovered: false,
      };
      this.victims.push(row);
    }
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
          const key = `${cx},${cz}`;
          if (this.foxCells.has(key)) continue;
          this.foxCells.add(key);
          r.exploredCells.add(key);
        }
      }
    }
  }

  private detectVictims() {
    for (const v of this.victims) {
      if (v.discovered) continue;
      const vx = v.x;
      const vz = v.z;
      for (const r of this.rovers) {
        if (r.state === "dead") continue;
        const [px, , pz] = r.position;
        if ((px - vx) ** 2 + (pz - vz) ** 2 < 2.25) {
          v.discovered = true;
          const vid = v.id;
          if (vid && !r.assignedVictims.includes(vid)) r.assignedVictims.push(vid);
          break;
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
        (r.id === "RoverB" && this.t >= COMM_LOSS_B) || (r.id === "RoverC" && this.t >= COMM_LOSS_C);
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

    this.detectVictims();

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
      rovers: this.rovers.map((r) => toPublicRover(r, this.t)),
      victims: [...this.victims],
      obstacles: this.obstacles,
      events: [],
      scenario_meta: {
        rover_b_comm_loss_start_s: COMM_LOSS_B,
        heartbeat_timeout_s: HB_TIMEOUT,
        expected_rover_b_dead_s: COMM_LOSS_B + HB_TIMEOUT,
      },
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
