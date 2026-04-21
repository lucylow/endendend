import { describe, expect, it } from "vitest";
import { createFallbackFlatEnvelope, createFallbackTasks, hashSeed } from "./fallback";

describe("fallback generators", () => {
  it("stable hashSeed", () => {
    expect(hashSeed("a")).toBe(hashSeed("a"));
    expect(hashSeed("a")).not.toBe(hashSeed("b"));
  });

  it("createFallbackFlatEnvelope is stable per seed", () => {
    const a = createFallbackFlatEnvelope("wildfire", "mid", "seed1");
    const b = createFallbackFlatEnvelope("wildfire", "mid", "seed1");
    expect(a.mapSummary.exploredCells).toBe(b.mapSummary.exploredCells);
    expect(a.nodes.length).toBe(b.nodes.length);
  });

  it("createFallbackTasks lists tasks", () => {
    const t1 = createFallbackTasks("tunnel", "s");
    expect(t1.length).toBeGreaterThan(0);
    expect(t1[0]?.source).toBe("mock");
  });
});
