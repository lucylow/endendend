import type { BillingTier } from "@/features/billing/types";

/** List prices and tier rules — single source for dashboard + future metering API. */
export const MONETIZATION = {
  /** USD per agent-minute (coordination meter). */
  coordinationUsdPerAgentMinute: 0.001,
  /** Fee on cleared task / deal notional (0.1%). */
  settlementFeeRate: 0.001,
  /** When paying in native token, charge this fraction of USD list (2% discount). */
  tctVsUsdMultiplier: 0.98,
  /** Short-lived permit TTL for coordination gates (ms). */
  coordinationPermitTtlMs: 50,
  /** Internal “credits” multiplier vs USD by tier (matches Nexus-style uplift / enterprise discount). */
  tierCreditMultipliers: {
    free: 2,
    pro: 1,
    enterprise: 0.5,
  } satisfies Record<BillingTier, number>,
  /** Distinct agent identities allowed per calendar month (UTC). `null` = unlimited. */
  agentIdentitiesPerMonth: {
    free: 100,
    pro: 10_000,
    enterprise: null,
  } satisfies Record<BillingTier, number | null>,
  premiumAddOnsUsdPerMonth: {
    missionReplay: 10,
    predictiveCoordination: 50,
    multiModal: 100,
  } as const,
} as const;

export type PremiumAddOn = keyof typeof MONETIZATION.premiumAddOnsUsdPerMonth;

export function roundUsd4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export function agentQuotaLabel(tier: BillingTier): string {
  const cap = MONETIZATION.agentIdentitiesPerMonth[tier];
  return cap == null ? "Unlimited" : `${cap.toLocaleString("en-US")}/mo`;
}

export function creditsMultiplier(tier: BillingTier): number {
  return MONETIZATION.tierCreditMultipliers[tier];
}

/** Gross USD for coordination usage before tier credit adjustment. */
export function coordinationListUsd(agentMinutes: number): number {
  if (!Number.isFinite(agentMinutes) || agentMinutes < 0) return 0;
  return roundUsd4(agentMinutes * MONETIZATION.coordinationUsdPerAgentMinute);
}

export function settlementFeeUsd(dealValueUsd: number): number {
  if (!Number.isFinite(dealValueUsd) || dealValueUsd < 0) return 0;
  return roundUsd4(dealValueUsd * MONETIZATION.settlementFeeRate);
}

export function premiumAddOnUsd(feature: PremiumAddOn): number {
  return MONETIZATION.premiumAddOnsUsdPerMonth[feature];
}

/** Amount charged if customer pays in TCT-equivalent at list USD. */
export function tokenPaymentUsdEquivalent(listUsd: number): number {
  if (!Number.isFinite(listUsd) || listUsd < 0) return 0;
  return roundUsd4(listUsd * MONETIZATION.tctVsUsdMultiplier);
}

export function creditsForUsage(listUsd: number, tier: BillingTier): number {
  return roundUsd4(listUsd * creditsMultiplier(tier));
}

export function utcMonthStartEpochSeconds(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0) / 1000);
}

export function isSameUtcMonth(epochSecA: number, epochSecB: number): boolean {
  const a = new Date(epochSecA * 1000);
  const b = new Date(epochSecB * 1000);
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

export function agentQuotaCheck(
  tier: BillingTier,
  agentsUsedThisUtcMonth: number,
): { ok: boolean; limit: number | null } {
  const limit = MONETIZATION.agentIdentitiesPerMonth[tier];
  if (limit == null) return { ok: true, limit: null };
  if (!Number.isFinite(agentsUsedThisUtcMonth) || agentsUsedThisUtcMonth < 0) {
    return { ok: true, limit };
  }
  return { ok: agentsUsedThisUtcMonth <= limit, limit };
}
