import { describe, expect, it } from "vitest";
import { MissionLedger } from "@/backend/vertex/mission-ledger";
import { NodeRegistry } from "@/backend/lattice/node-registry";
import { ScenarioCompiler } from "@/backend/shared/mission-policy";
import { SafetyEngine } from "@/backend/safety/safety-engine";
import { processMissionTelemetry, createSafetyEngine } from "@/backend/api/mission-safety";

describe("SafetyEngine", () => {
  it("escalates critical geofence violation with Vertex ordering + Lattice trust hit", async () => {
    const ledger = new MissionLedger();
    const registry = new NodeRegistry();
    const policy = new ScenarioCompiler().compile("collapsed_building");
    registry.seedRoster({
      drone1: { nodeId: "drone1", role: "explorer", joinedAtMs: 0, capabilities: [] },
    });
    const safety = createSafetyEngine(ledger, registry, policy);

    const alert = safety.assessTelemetry("drone1", { distanceFromGeofence: 2, position: { lat: 1, lng: 2 } });
    expect(alert?.severity).toBe("critical");
    expect(alert?.responseRequired).toContain("reassign");

    const state = await safety.escalate("m-safety", alert!, 1_900_000_000_000);
    expect(state.emergencyMode).toBe(true);
    expect(state.committedEventHash).toMatch(/^[a-f0-9]{64}$/);
    expect(registry.getTrustScore("drone1")).toBeLessThan(100);

    const tail = ledger.eventsForMission("m-safety").filter((e) => e.eventType === "safety_alert");
    expect(tail).toHaveLength(1);
    expect(tail[0].payload.responseRequired).toContain("reassign");
  });

  it("processMissionTelemetry returns null when telemetry is clean", async () => {
    const ledger = new MissionLedger();
    const registry = new NodeRegistry();
    const policy = new ScenarioCompiler().compile("extraction");
    const engine = new SafetyEngine(ledger, registry, policy);
    const r = await processMissionTelemetry(engine, "m1", "n1", { batteryReserve: 0.9, linkQuality: 0.9 }, 1);
    expect(r).toBeNull();
  });

  it("getSafetySummary aggregates committed safety rows", async () => {
    const ledger = new MissionLedger();
    const registry = new NodeRegistry();
    const policy = new ScenarioCompiler().compile("collapsed_building");
    const safety = new SafetyEngine(ledger, registry, policy);
    await ledger.append({
      missionId: "m2",
      actorId: "n1",
      eventType: "safety_alert",
      plane: "vertex",
      payload: { kind: "gas_detected", level: "warn", message: "ppm elevated" },
      timestamp: 10,
      previousHash: ledger.tailHash(),
    });
    const sum = safety.getSafetySummary("m2");
    expect(sum.escalatedCount).toBe(1);
    expect(sum.activeAlerts.length).toBe(1);
  });
});
