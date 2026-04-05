import { describe, expect, it } from "vitest";
import { mergeTelemetryFromPeers } from "./mergePeerTelemetry";
import type { AgentTelemetry } from "@/types/websocket";

describe("mergeTelemetryFromPeers", () => {
  it("picks latest serverTime per agent", () => {
    const a: AgentTelemetry = {
      id: "x",
      role: "relay",
      position: { x: 0, y: 0, z: 0 },
      battery: 90,
      status: "active",
      serverTimeMs: 100,
    };
    const b: AgentTelemetry = { ...a, serverTimeMs: 200, battery: 80 };
    const { merged } = mergeTelemetryFromPeers([[a], [b]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.serverTimeMs).toBe(200);
    expect(merged[0]!.battery).toBe(80);
  });

  it("flags role conflict at similar timestamps", () => {
    const t = Date.now();
    const p1: AgentTelemetry = {
      id: "x",
      role: "explorer",
      position: { x: 0, y: 0, z: 0 },
      battery: 90,
      status: "active",
      serverTimeMs: t,
    };
    const p2: AgentTelemetry = { ...p1, role: "relay", serverTimeMs: t + 10 };
    const { hasConflict } = mergeTelemetryFromPeers([[p1], [p2]]);
    expect(hasConflict).toBe(true);
  });
});
