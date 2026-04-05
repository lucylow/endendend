import type { BillingTier } from "./types";

/** Client-side price IDs (optional mirror of server env for tier detection). */
export const stripePriceIds = {
  pro: import.meta.env.VITE_STRIPE_PRO_PRICE_ID ?? "",
  enterprise: import.meta.env.VITE_STRIPE_ENTERPRISE_PRICE_ID ?? "",
} as const;

const CUSTOMER_LS = "tashi_stripe_customer_id";

export function getStoredCustomerId(): string | null {
  try {
    return localStorage.getItem(CUSTOMER_LS);
  } catch {
    return null;
  }
}

export function setStoredCustomerId(id: string) {
  try {
    localStorage.setItem(CUSTOMER_LS, id);
  } catch {
    /* ignore */
  }
}

export function clearStoredCustomerId() {
  try {
    localStorage.removeItem(CUSTOMER_LS);
  } catch {
    /* ignore */
  }
}

export function subscriptionTier(
  sub: import("./types").BillingSubscription | null,
): BillingTier {
  if (!sub || sub.status === "canceled") return "free";
  const md = sub.metadata?.tier;
  if (md === "pro" || md === "enterprise") return md;
  const pid = sub.items.data[0]?.price?.id;
  if (pid && stripePriceIds.enterprise && pid === stripePriceIds.enterprise) return "enterprise";
  if (pid && stripePriceIds.pro && pid === stripePriceIds.pro) return "pro";
  if (sub.status === "active" || sub.status === "trialing") return "pro";
  return "free";
}

export function billingApiBase(): string {
  const base = import.meta.env.VITE_BILLING_API_URL ?? "";
  return base.replace(/\/$/, "");
}

export function billingFetchPath(path: string): string {
  const b = billingApiBase();
  return b ? `${b}${path}` : path;
}
