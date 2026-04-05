import { describe, expect, it } from "vitest";
import {
  agentQuotaCheck,
  agentQuotaLabel,
  coordinationListUsd,
  creditsForUsage,
  MONETIZATION,
  settlementFeeUsd,
  tokenPaymentUsdEquivalent,
  utcMonthStartEpochSeconds,
} from "./pricing";

describe("monetization pricing", () => {
  it("charges 0.001 USD per agent-minute", () => {
    expect(coordinationListUsd(60)).toBe(0.06);
    expect(coordinationListUsd(1)).toBe(0.001);
  });

  it("applies 0.1% settlement fee", () => {
    expect(settlementFeeUsd(10_000)).toBe(10);
    expect(settlementFeeUsd(1_000)).toBe(1);
  });

  it("applies tier credit multipliers", () => {
    const base = 1;
    expect(creditsForUsage(base, "free")).toBe(2);
    expect(creditsForUsage(base, "pro")).toBe(1);
    expect(creditsForUsage(base, "enterprise")).toBe(0.5);
  });

  it("applies TCT discount to list USD", () => {
    expect(tokenPaymentUsdEquivalent(100)).toBe(98);
  });

  it("enforces agent identity caps", () => {
    expect(agentQuotaCheck("free", 100).ok).toBe(true);
    expect(agentQuotaCheck("free", 101).ok).toBe(false);
    expect(agentQuotaCheck("pro", 10_000).ok).toBe(true);
    expect(agentQuotaCheck("pro", 10_001).ok).toBe(false);
    expect(agentQuotaCheck("enterprise", 1_000_000).ok).toBe(true);
  });

  it("formats quota labels", () => {
    expect(agentQuotaLabel("free")).toContain("100");
    expect(agentQuotaLabel("enterprise")).toBe("Unlimited");
  });

  it("utc month start is first of month", () => {
    const t = Date.UTC(2026, 3, 15, 12, 0, 0);
    const start = utcMonthStartEpochSeconds(t);
    expect(new Date(start * 1000).getUTCDate()).toBe(1);
    expect(new Date(start * 1000).getUTCMonth()).toBe(3);
  });

  it("keeps constants in sync with product docs shape", () => {
    expect(MONETIZATION.agentIdentitiesPerMonth.free).toBe(100);
    expect(MONETIZATION.agentIdentitiesPerMonth.pro).toBe(10_000);
    expect(MONETIZATION.agentIdentitiesPerMonth.enterprise).toBeNull();
    expect(MONETIZATION.settlementFeeRate).toBe(0.001);
    expect(MONETIZATION.tctVsUsdMultiplier).toBe(0.98);
  });
});
