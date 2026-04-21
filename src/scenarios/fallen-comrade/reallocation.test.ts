import { describe, expect, it } from "vitest";
import { boundsUnion, reallocateDeadSector } from "./reallocation";

describe("reallocateDeadSector", () => {
  it("splits RoverB 20x20 strip among four survivors and unions bounds", () => {
    const dead: [number, number, number, number] = [20, 40, 0, 20];
    const current = {
      RoverA: [0, 20, 0, 20] as const,
      RoverC: [40, 60, 0, 20] as const,
      RoverD: [60, 80, 0, 20] as const,
      RoverE: [80, 100, 0, 20] as const,
    };
    const out = reallocateDeadSector(dead, ["RoverA", "RoverC", "RoverD", "RoverE"], current);
    expect(out.RoverA![0]).toBe(0);
    expect(out.RoverA![1]).toBeGreaterThanOrEqual(24);
    expect(out.RoverE![1]).toBe(100);
  });

  it("boundsUnion expands AABB", () => {
    const u = boundsUnion([0, 10, 0, 10], [8, 20, 0, 10]);
    expect(u).toEqual([0, 20, 0, 10]);
  });
});
