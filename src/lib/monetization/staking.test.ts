import { describe, expect, it } from "vitest";
import {
  TASHI_STAKING,
  applyStakingDiscountToUsd,
  estimateEpochStakerRewardUsd,
  feeDiscountRateForStakeTashi,
  hasStakingPriority,
  illustrativeApyPercentForStake,
  rewardMultiplierForStakeAndUptime,
  swarmStakeTier,
  swarmStakeTierId,
} from "./staking";

describe("TASHI staking monetization", () => {
  it("resolves tiers by stake amount", () => {
    expect(swarmStakeTierId(0)).toBe("none");
    expect(swarmStakeTierId(9_999)).toBe("none");
    expect(swarmStakeTier(10_000)?.id).toBe("standard");
    expect(swarmStakeTierId(10_000)).toBe("standard");
    expect(swarmStakeTierId(50_000)).toBe("high");
    expect(swarmStakeTierId(100_000)).toBe("mission_critical");
  });

  it("applies progressive fee discounts", () => {
    expect(feeDiscountRateForStakeTashi(0)).toBe(0);
    expect(feeDiscountRateForStakeTashi(10_000)).toBe(0.2);
    expect(feeDiscountRateForStakeTashi(50_000)).toBe(0.3);
    expect(feeDiscountRateForStakeTashi(100_000)).toBe(0.5);
  });

  it("grants priority only at or above minimum", () => {
    expect(hasStakingPriority(9_999)).toBe(false);
    expect(hasStakingPriority(10_000)).toBe(true);
  });

  it("stacks tier bonus with 99.9% availability bonus", () => {
    const m = rewardMultiplierForStakeAndUptime(100_000, 0.999);
    expect(m).toBeCloseTo(1.2 * 1.2, 5);
  });

  it("applies slashing per missed window", () => {
    const base = estimateEpochStakerRewardUsd({
      totalFeesUsd: 10_000,
      stakedTashi: 50_000,
      totalStakedTashi: 1_000_000,
      availability01: 0.99,
      missedConsensusWindows: 0,
    });
    const slashed = estimateEpochStakerRewardUsd({
      totalFeesUsd: 10_000,
      stakedTashi: 50_000,
      totalStakedTashi: 1_000_000,
      availability01: 0.99,
      missedConsensusWindows: 1,
    });
    expect(slashed).toBeCloseTo(base * 0.9, 5);
  });

  it("applies staking discount to USD meter line", () => {
    expect(applyStakingDiscountToUsd(100, 0.5)).toBe(50);
    expect(applyStakingDiscountToUsd(100, 0.2)).toBe(80);
  });

  it("maps illustrative APY to tiers", () => {
    expect(illustrativeApyPercentForStake(0)).toBe(0);
    expect(illustrativeApyPercentForStake(10_000)).toBe(20);
    expect(illustrativeApyPercentForStake(50_000)).toBe(35);
    expect(illustrativeApyPercentForStake(100_000)).toBe(48);
  });

  it("keeps operator share constant", () => {
    expect(TASHI_STAKING.operatorShareOfFeePool).toBe(0.6);
  });
});
