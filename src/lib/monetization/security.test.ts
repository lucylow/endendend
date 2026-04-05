import { describe, expect, it } from "vitest";
import {
  MONETIZATION_SECURITY,
  consensusSeverityFromLatencyMs,
  settlementRequiresMultiSig,
} from "./security";

describe("settlementRequiresMultiSig", () => {
  it("is false below threshold", () => {
    expect(settlementRequiresMultiSig(999.99)).toBe(false);
    expect(settlementRequiresMultiSig(0)).toBe(false);
  });

  it("is true at and above threshold", () => {
    expect(settlementRequiresMultiSig(MONETIZATION_SECURITY.settlementMultiSigThresholdUsd)).toBe(true);
    expect(settlementRequiresMultiSig(50_000)).toBe(true);
  });

  it("handles invalid numbers", () => {
    expect(settlementRequiresMultiSig(Number.NaN)).toBe(false);
    expect(settlementRequiresMultiSig(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("consensusSeverityFromLatencyMs", () => {
  it("returns ok under warn threshold", () => {
    expect(consensusSeverityFromLatencyMs(0)).toBe("ok");
    expect(consensusSeverityFromLatencyMs(MONETIZATION_SECURITY.consensusLatencyWarnMs - 1)).toBe("ok");
  });

  it("returns warn in band", () => {
    expect(consensusSeverityFromLatencyMs(MONETIZATION_SECURITY.consensusLatencyWarnMs)).toBe("warn");
    expect(consensusSeverityFromLatencyMs(MONETIZATION_SECURITY.consensusLatencyCriticalMs - 1)).toBe("warn");
  });

  it("returns critical at and above critical threshold", () => {
    expect(consensusSeverityFromLatencyMs(MONETIZATION_SECURITY.consensusLatencyCriticalMs)).toBe("critical");
    expect(consensusSeverityFromLatencyMs(500)).toBe("critical");
  });
});
