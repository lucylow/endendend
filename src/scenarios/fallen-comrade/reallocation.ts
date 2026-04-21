import type { Bounds } from "./types";

export function boundsUnion(a: Bounds, b: Bounds): Bounds {
  return [Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3])];
}

/** Equal strips along X inside deadBounds, unioned with each survivor's current bounds. */
export function reallocateDeadSector(
  deadBounds: Bounds,
  survivors: readonly string[],
  currentBounds: Readonly<Record<string, Bounds>>,
): Record<string, Bounds> {
  const ids = [...survivors];
  const n = ids.length;
  if (n === 0) return { ...currentBounds };
  const [xmin, xmax, zmin, zmax] = deadBounds;
  const width = xmax - xmin;
  const step = width / n;
  const out: Record<string, Bounds> = {};
  for (const k of Object.keys(currentBounds)) {
    if (ids.includes(k)) out[k] = currentBounds[k]!;
  }
  for (let i = 0; i < n; i++) {
    const sid = ids[i]!;
    const x0 = xmin + i * step;
    const x1 = xmin + (i + 1) * step;
    const strip: Bounds = [x0, x1, zmin, zmax];
    const prev = out[sid] ?? strip;
    out[sid] = boundsUnion(prev, strip);
  }
  return out;
}
