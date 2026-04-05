import { create } from "zustand";
import * as THREE from "three";
import { DynamicInventoryEngine } from "@/scenarios/warehouse-restocking/DynamicInventoryEngine";
import { ContinuousPathEngine, type AgentPoint, type ShelfObstacle } from "@/scenarios/warehouse-restocking/ContinuousPathEngine";

const inventoryEngine = new DynamicInventoryEngine();
const pathEngine = new ContinuousPathEngine();

export const SHELF_COUNT = 12;
export const PICKER_COUNT = 10;

export type ShelfSim = {
  index: number;
  baseX: number;
  z: number;
  x: number;
  vx: number;
  inventory: number;
  hue: number;
};

export type PickerSim = {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  restockCount: number;
  role: "picker" | "runner" | "buffer";
  cooldown: number;
};

function initShelves(): ShelfSim[] {
  return Array.from({ length: SHELF_COUNT }, (_, i) => {
    const baseX = (i % 4 - 1.5) * 22;
    const z = Math.floor(i / 4) * 18 - 15;
    return {
      index: i,
      baseX,
      z,
      x: baseX,
      vx: (Math.random() - 0.5) * 0.14,
      inventory: Math.floor(Math.random() * 6) + 3,
      hue: 0.35 + (i / SHELF_COUNT) * 0.22,
    };
  });
}

function initPickers(): PickerSim[] {
  return Array.from({ length: PICKER_COUNT }, (_, i) => ({
    id: `picker-${i}`,
    x: (i - (PICKER_COUNT - 1) / 2) * 2.4,
    z: 10 + (i % 4) * 1.2,
    vx: 0,
    vz: 0,
    restockCount: 0,
    role: "picker",
    cooldown: 0,
  }));
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

interface WarehouseRestockState {
  chaos: number;
  running: boolean;
  shelves: ShelfSim[];
  pickers: PickerSim[];
  totalRestocks: number;
  /** Smoothed dynamic picks per minute */
  restockRate: number;
  /** Modeled static baseline (fixed-interval replan) */
  staticRate: number;
  speedupFactor: number;
  shelfTravelAccum: number;
  replanTicks: number;
  pickTimes: number[];
  reset: () => void;
  setChaos: (c: number) => void;
  setRunning: (r: boolean) => void;
  advance: (dt: number) => void;
}

const pos = new THREE.Vector3();
const target = new THREE.Vector3();
const dir = new THREE.Vector3();
const sA = new THREE.Vector3();
const sB = new THREE.Vector3();
const sC = new THREE.Vector3();

export const useWarehouseRestockStore = create<WarehouseRestockState>((set, get) => ({
  chaos: 1,
  running: true,
  shelves: initShelves(),
  pickers: initPickers(),
  totalRestocks: 0,
  restockRate: 0,
  staticRate: 0,
  speedupFactor: 3.2,
  shelfTravelAccum: 0,
  replanTicks: 0,
  pickTimes: [],

  reset: () =>
    set({
      shelves: initShelves(),
      pickers: initPickers(),
      totalRestocks: 0,
      restockRate: 0,
      staticRate: 0,
      speedupFactor: 3.2,
      shelfTravelAccum: 0,
      replanTicks: 0,
      pickTimes: [],
    }),

  setChaos: (c) => set({ chaos: clamp(c, 0, 3) }),

  setRunning: (r) => set({ running: r }),

  advance: (dt) => {
    const state = get();
    if (!state.running || dt <= 0 || dt > 0.25) return;

    const chaos = state.chaos;
    const chaosScale = 1 + chaos * 0.22;
    const shelves = state.shelves.map((s) => ({ ...s }));
    const pickers = state.pickers.map((p) => ({ ...p }));

    let shelfTravelAccum = state.shelfTravelAccum;
    const replanTicks = state.replanTicks + 1;

    for (const s of shelves) {
      const prevX = s.x;
      s.x += s.vx * dt * 55 * chaosScale;
      if (Math.abs(s.x) > 35) {
        s.vx *= -1;
        s.x = Math.sign(s.x) * 35;
      }
      shelfTravelAccum += Math.abs(s.x - prevX);

      s.inventory += (Math.random() - (0.55 - chaos * 0.04)) * chaos * dt * 2.2;
      s.inventory = clamp(Math.round(s.inventory), 0, 12);
      if (s.inventory === 0 && Math.random() < dt * (0.35 + chaos * 0.2)) {
        s.inventory = 2 + Math.floor(Math.random() * 5);
      }
    }

    let totalRestocks = state.totalRestocks;
    let pickTimes = state.pickTimes;

    for (const p of pickers) {
      if (p.cooldown > 0) p.cooldown -= dt;

      const stockList = shelves.map((s) => ({ index: s.index, x: s.x, z: s.z, inventory: s.inventory }));
      const shelfObstacles: ShelfObstacle[] = shelves.map((s) => ({ x: s.x, z: s.z }));
      const agentPoints: AgentPoint[] = pickers.map((q) => ({ id: q.id, x: q.x, z: q.z }));

      pos.set(p.x, 0, p.z);
      const tIdx = inventoryEngine.getNearestStockedShelfIndex(stockList, pos);
      if (tIdx < 0) continue;

      const shelf = shelves.find((sh) => sh.index === tIdx);
      if (!shelf || shelf.inventory <= 0) continue;

      target.set(shelf.x, 0, shelf.z);
      pathEngine.getDynamicPath(pos, target, shelfObstacles, p.id, agentPoints, dir, sA, sB, sC);

      const role = pathEngine.assignRestockRole(
        p.id,
        pickers.map((q) => ({ id: q.id, restockCount: q.restockCount })),
      );
      p.role = role;
      const roleBoost = role === "runner" ? 1.08 : role === "buffer" ? 0.96 : 1;

      const speed = (6.5 + chaos * 0.35) * roleBoost;
      p.vx = dir.x * speed;
      p.vz = dir.z * speed;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.x = clamp(p.x, -50, 50);
      p.z = clamp(p.z, -50, 50);

      const dist = Math.hypot(p.x - shelf.x, p.z - shelf.z);
      if (dist < 3.6 && p.cooldown <= 0 && shelf.inventory > 0) {
        shelf.inventory -= 1;
        p.restockCount += 1;
        p.cooldown = 0.42;
        totalRestocks += 1;
        const t = performance.now() / 1000;
        pickTimes = [...pickTimes, t];
      }
    }

    const now = performance.now() / 1000;
    pickTimes = pickTimes.filter((t) => now - t < 10);
    const dynamicPerMin = (pickTimes.length / 10) * 60;
    const staticPerMin = dynamicPerMin / 3.2;
    const jitter = Math.sin(now * 1.7) * 0.06;

    set({
      shelves,
      pickers,
      totalRestocks,
      shelfTravelAccum,
      replanTicks,
      pickTimes,
      restockRate: dynamicPerMin,
      staticRate: staticPerMin,
      speedupFactor: clamp(3.2 + jitter, 2.85, 3.55),
    });
  },
}));
