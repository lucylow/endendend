export type BillingTier = "free" | "pro" | "enterprise";

export interface BillingSubscription {
  id: string;
  status: string;
  current_period_end: number | null;
  cancel_at_period_end?: boolean;
  items: {
    data: Array<{
      price: {
        id?: string;
        unit_amount: number | null;
        currency: string;
      };
    }>;
  };
  metadata?: Record<string, string>;
}

export interface BillingContextValue {
  currentTier: BillingTier;
  subscription: BillingSubscription | null;
  isActive: boolean;
  isTrialing: boolean;
  customerId: string | null;
  /** Billing API reachable and Stripe secret configured on server */
  billingApiConfigured: boolean;
  /** VITE_STRIPE_PUBLISHABLE_KEY set (Elements + Checkout redirect client) */
  publishableKeyConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  createCheckoutSession: (tier: Exclude<BillingTier, "free">) => Promise<void>;
  openPortal: () => Promise<void>;
  syncCheckoutSession: (sessionId: string) => Promise<void>;
  refreshSubscription: () => Promise<void>;
}
