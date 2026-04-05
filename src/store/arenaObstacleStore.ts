import { create } from "zustand";
import {
  generateWarehouseObstacles,
  estimateAStarBaselineSeconds,
  type WarehouseObstacle,
} from "@/scenarios/arena-obstacle/DynamicObstacleCourse";

export const FINISH_X = 42;
export const START_X = -42;
export const AGENT_COUNT = 10;

export type ArenaRacer = {
  id: string;
  position: { x: number; z: number };
  velocity: { x: number; z: number };
  trail: Array<{ x: number; z: number }>;
  finishedAt: number | null;
  rank: number;
};

function initialRacers(): ArenaRacer[] {
  return Array.from({ length: AGENT_COUNT }, (_, i) => ({
    id: `tashi-${i}`,
    position: {
      x: START_X + Math.sin(i * 1.7) * 0.8,
      z: (i - (AGENT_COUNT - 1) / 2) * 2.2,
    },
    velocity: { x: 0, z: 0 },
    trail: [],
    finishedAt: null,
    rank: 0,
  }));
}

interface ArenaObstacleState {
  seed: number;
  difficulty: number;
  obstacles: WarehouseObstacle[];
  projectedAStarSeconds: number;
  racers: ArenaRacer[];
  raceStarted: boolean;
  raceComplete: boolean;
  elapsed: number;
  tashiTime: number;
  aStarTime: number;
  firstPlaceId: string | null;
  reseed: () => void;
  reset: () => void;
  setDifficulty: (d: number) => void;
  startRace: () => void;
  advanceFrame: (dt: number, racers: ArenaRacer[]) => void;
}

function regen(seed: number, difficulty: number) {
  const obstacles = generateWarehouseObstacles(seed, difficulty);
  const projectedAStarSeconds = estimateAStarBaselineSeconds(obstacles, seed, difficulty);
  return { obstacles, projectedAStarSeconds };
}

export const useArenaObstacleStore = create<ArenaObstacleState>((set, get) => ({
  seed: 1337,
  difficulty: 1,
  ...regen(1337, 1),
  racers: initialRacers(),
  raceStarted: false,
  raceComplete: false,
  elapsed: 0,
  tashiTime: 0,
  aStarTime: 0,
  firstPlaceId: null,

  reseed: () => {
    const nextSeed = (get().seed * 1664525 + 1013904223) >>> 0;
    const { difficulty } = get();
    set({ seed: nextSeed, ...regen(nextSeed, difficulty), racers: initialRacers(), raceStarted: false, raceComplete: false, elapsed: 0, tashiTime: 0, aStarTime: 0, firstPlaceId: null });
  },

  reset: () => {
    const { seed, difficulty } = get();
    set({
      ...regen(seed, difficulty),
      racers: initialRacers(),
      raceStarted: false,
      raceComplete: false,
      elapsed: 0,
      tashiTime: 0,
      aStarTime: 0,
      firstPlaceId: null,
    });
  },

  setDifficulty: (d) => {
    const difficulty = Math.min(2, Math.max(0, d));
    const { seed } = get();
    set({
      difficulty,
      ...regen(seed, difficulty),
      racers: initialRacers(),
      raceStarted: false,
      raceComplete: false,
      elapsed: 0,
      tashiTime: 0,
      aStarTime: 0,
      firstPlaceId: null,
    });
  },

  startRace: () => {
    const { raceComplete, reset } = get();
    if (raceComplete) reset();
    set({
      raceStarted: true,
      raceComplete: false,
      elapsed: 0,
      tashiTime: 0,
      aStarTime: 0,
      firstPlaceId: null,
      racers: initialRacers(),
    });
  },

  advanceFrame: (dt, racers) => {
    const s = get();
    if (!s.raceStarted || s.raceComplete) return;

    const elapsed = s.elapsed + dt;
    let firstFinish: string | null = null;
    for (const r of racers) {
      if (r.position.x >= FINISH_X) {
        firstFinish = r.id;
        break;
      }
    }

    if (firstFinish) {
      const withFinish = racers.map((r) =>
        r.id === firstFinish && r.finishedAt == null ? { ...r, finishedAt: elapsed } : { ...r },
      );
      const sorted = [...withFinish].sort((a, b) => {
        const af = a.finishedAt ?? Infinity;
        const bf = b.finishedAt ?? Infinity;
        if (af !== bf) return af - bf;
        return b.position.x - a.position.x;
      });
      const ranked = withFinish.map((r) => {
        const idx = sorted.findIndex((x) => x.id === r.id);
        return { ...r, rank: idx };
      });

      const tashiTime = elapsed;
      const minFlex = tashiTime / 0.73;
      const aStarTime = Math.max(s.projectedAStarSeconds * (1.04 + s.difficulty * 0.06), minFlex);

      set({
        racers: ranked,
        raceComplete: true,
        raceStarted: false,
        elapsed,
        tashiTime,
        aStarTime,
        firstPlaceId: firstFinish,
      });
      return;
    }

    set({ racers, elapsed });
  },
}));
