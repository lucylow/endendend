/** FNV-1a style string hash → uint32 (stable across runtimes for same input). */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG factory; deterministic for seed `a`. */
export function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededRandom {
  private rng: () => number;
  constructor(seed: string | number) {
    const n = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
    this.rng = mulberry32(n);
  }

  next(): number {
    return this.rng();
  }

  nextInt(min: number, maxExclusive: number): number {
    return min + Math.floor(this.next() * Math.max(1, maxExclusive - min));
  }

  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.nextInt(0, arr.length)]!;
  }

  /** Approximate Gaussian via sum of uniforms. */
  gaussian(mean = 0, sigma = 1): number {
    let s = 0;
    for (let i = 0; i < 6; i++) s += this.next();
    return mean + sigma * (s - 3);
  }
}
