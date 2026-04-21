import { describe, expect, it } from "vitest";
import { buildTunnelGeometry } from "../tunnelGeometry";
import { createMockAdapter } from "../mockAdapter";
import { MissionReplay } from "../replay";
import { chainIsPartitioned, pickExplorer, planRelayChain } from "../relayPlanner";
import { DynamicDaisyScenarioEngine, simNodeId } from "../scenarioEngine";
import { endToEndQuality, signalHopsAlongChain } from "../signalModel";

describe("Dynamic Daisy Chain scenario engine", () => {
  it("builds identical tunnel geometry for the same seed", () => {
    const a = buildTunnelGeometry("default", 9001);
    const b = buildTunnelGeometry("default", 9001);
    expect(a.lengthM).toBe(b.lengthM);
    expect(a.segments.length).toBe(b.segments.length);
  });

  it("differs tunnel geometry across variants", () => {
    const shallow = buildTunnelGeometry("default", 1);
    const deep = buildTunnelGeometry("deep", 1);
    expect(deep.lengthM).toBeGreaterThanOrEqual(shallow.lengthM);
  });

  it("keeps non-degenerate relay planning for a deep lead", () => {
    const eng = new DynamicDaisyScenarioEngine(404, "relay_heavy");
    let snap = eng.step(0);
    for (let i = 0; i < 500; i++) {
      snap = eng.step(0.04);
    }
    const lead = pickExplorer(snap.nodes);
    expect(lead).toBeTruthy();
    const plan = planRelayChain(snap.nodes, lead!, eng.cfg.tunnel, eng.cfg, () => 0.1);
    expect(plan.chainPath.at(-1)).toBe(simNodeId(lead!));
    expect(plan.orderedRelayIds.length).toBeGreaterThanOrEqual(0);
  });

  it("forms relay chain so end-to-end quality rises vs direct-only when relays present", () => {
    const eng = new DynamicDaisyScenarioEngine(55, "relay_heavy");
    let snap = eng.step(0);
    for (let i = 0; i < 900; i++) snap = eng.step(0.035);
    const lead = pickExplorer(snap.nodes)!;
    const tightCfg = { ...eng.cfg, relayLossThreshold: 0.04, partitionLossThreshold: 0.995 };
    const plan = planRelayChain(snap.nodes, lead, eng.cfg.tunnel, tightCfg, () => 0.2);
    expect(plan.orderedRelayIds.length).toBeGreaterThan(0);
    const relayIds = plan.orderedRelayIds;
    const withHops = signalHopsAlongChain(
      ["__entrance__", ...relayIds, simNodeId(lead)],
      new Map(
        [
          [
            "__entrance__",
            {
              ...lead,
              profile: { ...lead.profile, id: "__entrance__" },
              s: 0,
              isRelay: true,
              relayFrozen: true,
              relayHoldS: 0,
              role: "relay",
              forwardLoad: 0,
              hopLoss: 0,
              hopLatency: 0,
            },
          ],
          ...snap.nodes.map((n) => [simNodeId(n), n] as const),
        ],
      ),
      tightCfg.tunnel,
      () => 0.2,
      0.25,
    );
    const e2e = endToEndQuality(withHops);
    const direct = endToEndQuality(
      signalHopsAlongChain(
        ["__entrance__", simNodeId(lead)],
        new Map([
          [
            "__entrance__",
            {
              ...lead,
              profile: { ...lead.profile, id: "__entrance__" },
              s: 0,
              isRelay: true,
              relayFrozen: true,
              relayHoldS: 0,
              role: "relay",
              forwardLoad: 0,
              hopLoss: 0,
              hopLatency: 0,
            },
          ],
          [simNodeId(lead), lead],
        ]),
        tightCfg.tunnel,
        () => 0.2,
        0.25,
      ),
    );
    expect(e2e).toBeGreaterThan(direct);
  });

  it("mock adapter produces deterministic Track2 frames for a fixed seed", () => {
    const a = createMockAdapter(321, "default");
    const b = createMockAdapter(321, "default");
    const fa = a.step(0.1).track2;
    b.reset(321, "default");
    const fb = b.step(0.1).track2;
    expect(fa.tunnel_depth).toBeCloseTo(fb.tunnel_depth, 5);
    expect(fa.relay_chain.join()).toBe(fb.relay_chain.join());
  });

  it("replay buffer stays ordered by time", () => {
    const rep = new MissionReplay();
    const eng = new DynamicDaisyScenarioEngine(7, "default");
    for (let i = 0; i < 20; i++) rep.record(eng.step(0.05));
    expect(rep.frames.length).toBe(20);
    expect(rep.indexAtOrBefore(0.25)).toBeGreaterThanOrEqual(0);
    expect(rep.atIndex(rep.indexAtOrBefore(1e9))?.t).toBe(rep.frames[rep.frames.length - 1]?.t);
  });

  it("detects partition when lead quality collapses", () => {
    const cfg = {
      relayLossThreshold: 0.01,
      partitionLossThreshold: 0.01,
    } as import("../types").EngineConfig;
    expect(chainIsPartitioned(0.001, cfg)).toBe(true);
  });
});
