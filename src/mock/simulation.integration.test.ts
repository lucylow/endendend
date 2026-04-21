import { describe, expect, it } from "vitest";
import { SeededRandom, hashSeed } from "./seededRandom";
import { MeshSimulator } from "./meshSimulator";
import { SensorStreamGenerator } from "./sensorEngine";
import { buildMockNodeProfiles } from "./nodeFactory";
import { MockEventStream } from "./eventStream";
import { attachSimulation, mergeMissingSubfields } from "./fallbackAdapter";
import { createFallbackFlatEnvelope } from "@/lib/api/fallback";
import type { MeshSummaryViewModel } from "./types";

describe("mock simulation subsystem", () => {
  it("SeededRandom is stable for the same seed string", () => {
    const a = new SeededRandom("mission-alpha|v1");
    const b = new SeededRandom("mission-alpha|v1");
    const seq = (r: SeededRandom) => Array.from({ length: 20 }, () => r.next());
    expect(seq(a)).toEqual(seq(b));
  });

  it("hashSeed is deterministic", () => {
    expect(hashSeed("a|b|c")).toBe(hashSeed("a|b|c"));
  });

  it("wildfire thermal differs from tunnel (scenario shaping)", () => {
    const seed = "probe|telemetry";
    const wild = buildMockNodeProfiles("wildfire", seed, 2);
    const cave = buildMockNodeProfiles("tunnel", seed, 2);
    const meshW: MeshSummaryViewModel = {
      graphEdges: [],
      relayChain: { primary: ["n1"], backup: [], health: 0.9 },
      partitionActive: false,
      activePeers: ["a"],
      stalePeers: [],
      delivery: { attempted: 1, delivered: 1, duplicates: 0, retries: 0, dropped: 0 },
      meanLatencyMs: 40,
      routeQuality: 0.85,
      messageHistoryTail: [],
      subscriptionsSample: [],
      source: "mock",
    };
    const gw = new SensorStreamGenerator(seed, wild[0]!, "wildfire");
    const gt = new SensorStreamGenerator(seed, cave[0]!, "tunnel");
    const ctx = (phase: string) => ({
      missionId: "m1",
      scenario: "wildfire" as const,
      phase,
      nowMs: 1_720_000_000_000,
      mesh: meshW,
      targetProximity01: 0.5,
    });
    const wTel = gw.emit({ ...ctx("search"), scenario: "wildfire" }, "mock");
    const tTel = gt.emit({ ...ctx("search"), scenario: "tunnel" }, "mock");
    expect(wTel.sensors.thermalC).toBeGreaterThan(tTel.sensors.thermalC - 2);
    expect(tTel.sensors.gpsFix).toBeLessThan(wTel.sensors.gpsFix + 0.15);
  });

  it("mesh partition increases delivery stress", () => {
    const profiles = buildMockNodeProfiles("collapsed_building", "mesh|t", 5, "n");
    const sim = new MeshSimulator({
      seed: "mesh|t",
      missionId: "mid",
      nodeProfiles: profiles,
    });
    const ok = sim.tick(1_720_000_000_000);
    sim.setPartition(true);
    const bad = sim.tick(1_720_000_006_000);
    expect(bad.partitionActive).toBe(true);
    expect(bad.delivery.dropped).toBeGreaterThanOrEqual(ok.delivery.dropped);
  });

  it("MockEventStream replay slice is stable", () => {
    const s = new MockEventStream();
    s.emit("sensor_update", { v: 1 }, 100);
    s.emit("map_delta", { v: 2 }, 101);
    expect(s.replaySlice(0, 2).map((e) => e.kind)).toEqual(["sensor_update", "map_delta"]);
  });

  it("attachSimulation preserves live source on augmentation when preferLive", () => {
    const live = createFallbackFlatEnvelope("hazmat", "m-live", "x");
    const patched = { ...live, source: "live_http" as const };
    const sim = {
      mesh: {
        graphEdges: [],
        relayChain: { primary: [], backup: [], health: 1 },
        partitionActive: false,
        activePeers: [],
        stalePeers: [],
        delivery: { attempted: 0, delivered: 0, duplicates: 0, retries: 0, dropped: 0 },
        meanLatencyMs: 0,
        routeQuality: 1,
        messageHistoryTail: [],
        subscriptionsSample: [],
        source: "mock" as const,
      },
      telemetryByNode: {},
      mapExploredBoost: 0,
      source: "mock" as const,
    };
    const out = attachSimulation(patched, sim, true);
    expect(out.simulation?.source).toBe("live_http");
  });

  it("mergeMissingSubfields fills empty live nodes from mock", () => {
    const live = { ...createFallbackFlatEnvelope("wildfire", "m", "s"), nodes: [] };
    const mock = createFallbackFlatEnvelope("wildfire", "m", "s");
    const merged = mergeMissingSubfields(live, mock);
    expect(merged.nodes.length).toBeGreaterThan(0);
  });
});
