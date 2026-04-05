import { roundUsd4 } from "./pricing";

/**
 * $TASHI swarm staking — fee discounts, priority tiers, and reward-pool math.
 * Illustrative parameters for product UI and future metering; verify on-chain policy before mainnet.
 */
export const TASHI_STAKING = {
  minStakeTashi: 10_000,
  /** Share of daily coordination + settlement fees directed to operator / staker reward pool. */
  operatorShareOfFeePool: 0.6,
  /** Reward multiplier when availability meets SLO (e.g. 99.9%). */
  highAvailabilityThreshold: 0.999,
  highAvailabilityRewardBonus: 0.2,
  /** Penalty factor per missed consensus window (applied to epoch reward). */
  slashFractionPerMissedWindow: 0.1,
} as const;

export type SwarmStakeTierId = "none" | "standard" | "high" | "mission_critical";

export interface SwarmStakeTier {
  id: SwarmStakeTierId;
  minTashi: number;
  priorityLabel: string;
  /** Fraction off metered coordination fees (not settlement add-ons unless configured). */
  feeDiscount: number;
  /** Extra reward multiplier from tier (on top of pro-rata pool share). */
  tierRewardBonus: number;
  slashingRiskLabel: "high" | "medium" | "low";
  /** Illustrative APY % for dashboard calculator (not a guarantee). */
  illustrativeApyPercent: number;
}

const TIERS_DESC: SwarmStakeTier[] = [
  {
    id: "mission_critical",
    minTashi: 100_000,
    priorityLabel: "Mission-critical",
    feeDiscount: 0.5,
    tierRewardBonus: 0.2,
    slashingRiskLabel: "low",
    illustrativeApyPercent: 48,
  },
  {
    id: "high",
    minTashi: 50_000,
    priorityLabel: "High",
    feeDiscount: 0.3,
    tierRewardBonus: 0.15,
    slashingRiskLabel: "medium",
    illustrativeApyPercent: 35,
  },
  {
    id: "standard",
    minTashi: 10_000,
    priorityLabel: "Standard",
    feeDiscount: 0.2,
    tierRewardBonus: 0.1,
    slashingRiskLabel: "high",
    illustrativeApyPercent: 20,
  },
];

export function swarmStakeTier(stakedTashi: number): SwarmStakeTier | null {
  if (!Number.isFinite(stakedTashi) || stakedTashi < TASHI_STAKING.minStakeTashi) return null;
  for (const t of TIERS_DESC) {
    if (stakedTashi >= t.minTashi) return t;
  }
  return null;
}

export function swarmStakeTierId(stakedTashi: number): SwarmStakeTierId {
  return swarmStakeTier(stakedTashi)?.id ?? "none";
}

/** Fee discount rate in [0, 0.5] for metered coordination. */
export function feeDiscountRateForStakeTashi(stakedTashi: number): number {
  return swarmStakeTier(stakedTashi)?.feeDiscount ?? 0;
}

export function hasStakingPriority(stakedTashi: number): boolean {
  return swarmStakeTier(stakedTashi) != null;
}

/** Apply staking discount after any token-pay adjustment. */
export function applyStakingDiscountToUsd(usd: number, feeDiscountRate: number): number {
  if (!Number.isFinite(usd) || usd < 0) return 0;
  const r = Math.min(1, Math.max(0, feeDiscountRate));
  return roundUsd4(usd * (1 - r));
}

export function rewardMultiplierForStakeAndUptime(stakedTashi: number, availability01: number): number {
  const tier = swarmStakeTier(stakedTashi);
  if (!tier) return 1;
  let m = 1 + tier.tierRewardBonus;
  if (Number.isFinite(availability01) && availability01 >= TASHI_STAKING.highAvailabilityThreshold) {
    m *= 1 + TASHI_STAKING.highAvailabilityRewardBonus;
  }
  return m;
}

export interface EpochSettlementInput {
  /** Sum of coordination + settlement fees for the epoch (USD). */
  totalFeesUsd: number;
  stakedTashi: number;
  /** Aggregate stake for weighting. */
  totalStakedTashi: number;
  /** Agent uptime / consensus participation in [0, 1]. */
  availability01: number;
  missedConsensusWindows: number;
}

/**
 * Pro-rata share of operator pool for one staker, with tier + uptime bonuses and slashing.
 */
export function estimateEpochStakerRewardUsd(input: EpochSettlementInput): number {
  const { totalFeesUsd, stakedTashi, totalStakedTashi, availability01, missedConsensusWindows } = input;
  if (!Number.isFinite(totalFeesUsd) || totalFeesUsd <= 0) return 0;
  if (!Number.isFinite(stakedTashi) || stakedTashi <= 0) return 0;
  if (!Number.isFinite(totalStakedTashi) || totalStakedTashi <= 0) return 0;

  const operatorPool = totalFeesUsd * TASHI_STAKING.operatorShareOfFeePool;
  const weight = stakedTashi / totalStakedTashi;
  let reward = operatorPool * weight;

  if (swarmStakeTier(stakedTashi)) {
    reward *= rewardMultiplierForStakeAndUptime(stakedTashi, availability01);
  }

  const misses = Math.max(0, Math.floor(missedConsensusWindows));
  const slashFactor = Math.max(0, 1 - misses * TASHI_STAKING.slashFractionPerMissedWindow);
  return roundUsd4(reward * slashFactor);
}

export function illustrativeApyPercentForStake(stakedTashi: number): number {
  return swarmStakeTier(stakedTashi)?.illustrativeApyPercent ?? 0;
}

export function stakingTiersForDocs(): readonly SwarmStakeTier[] {
  return TIERS_DESC;
}
