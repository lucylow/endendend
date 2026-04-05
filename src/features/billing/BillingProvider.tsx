import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { BillingContextValue, BillingSubscription } from "./types";
import {
  billingFetchPath,
  clearStoredCustomerId,
  getStoredCustomerId,
  setStoredCustomerId,
  subscriptionTier,
} from "./stripeConfig";

const BillingContext = createContext<BillingContextValue | null>(null);

const hasPublishableKey = Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

async function parseJsonSafe(res: Response): Promise<{ error?: string; [k: string]: unknown }> {
  try {
    return (await res.json()) as { error?: string; [k: string]: unknown };
  } catch {
    return {};
  }
}

export function BillingProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(() => getStoredCustomerId());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingApiConfigured, setBillingApiConfigured] = useState(true);

  const refreshSubscription = useCallback(async () => {
    const id = getStoredCustomerId();
    setCustomerId(id);
    if (!id) {
      setSubscription(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const url = `${billingFetchPath("/api/billing/subscription")}?customerId=${encodeURIComponent(id)}`;
      const res = await fetch(url);
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        if (res.status === 503) setBillingApiConfigured(false);
        setError(typeof data.error === "string" ? data.error : "Failed to load subscription");
        setSubscription(null);
        return;
      }
      setBillingApiConfigured(true);
      const sub = data.subscription as BillingSubscription | null | undefined;
      setSubscription(sub ?? null);
    } catch {
      setError("Network error loading subscription");
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  const createCheckoutSession = useCallback(async (tier: "pro" | "enterprise") => {
    setError(null);
    try {
      const origin = window.location.origin;
      const res = await fetch(billingFetchPath("/api/billing/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          successUrl: `${origin}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/dashboard/billing`,
        }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : "Checkout failed";
        toast.error(msg);
        if (res.status === 503) setBillingApiConfigured(false);
        return;
      }
      const url = data.url as string | undefined;
      if (url) window.location.href = url;
      else toast.error("No checkout URL returned");
    } catch {
      toast.error("Could not start checkout");
    }
  }, []);

  const openPortal = useCallback(async () => {
    const id = getStoredCustomerId();
    if (!id) {
      toast.error("No Stripe customer on this device — open billing after subscribing.");
      return;
    }
    setError(null);
    try {
      const origin = window.location.origin;
      const res = await fetch(billingFetchPath("/api/billing/portal"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: id,
          returnUrl: `${origin}/dashboard/billing`,
        }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Portal failed");
        return;
      }
      const url = data.url as string | undefined;
      if (url) window.location.href = url;
      else toast.error("No portal URL returned");
    } catch {
      toast.error("Could not open billing portal");
    }
  }, []);

  const syncCheckoutSession = useCallback(
    async (sessionId: string) => {
      setError(null);
      try {
        const res = await fetch(billingFetchPath("/api/billing/sync-session"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Could not confirm checkout");
          return;
        }
        const cid = data.customerId as string | undefined;
        if (cid) {
          setStoredCustomerId(cid);
          setCustomerId(cid);
        }
        const sub = data.subscription as BillingSubscription | null | undefined;
        setSubscription(sub ?? null);
        toast.success("Subscription synced");
      } catch {
        toast.error("Could not sync checkout session");
      }
    },
    [],
  );

  const currentTier = subscriptionTier(subscription);
  const isActive = subscription?.status === "active";
  const isTrialing = subscription?.status === "trialing";

  const value = useMemo<BillingContextValue>(
    () => ({
      currentTier,
      subscription,
      isActive,
      isTrialing,
      customerId,
      billingApiConfigured,
      publishableKeyConfigured: hasPublishableKey,
      isLoading,
      error,
      createCheckoutSession,
      openPortal,
      syncCheckoutSession,
      refreshSubscription,
    }),
    [
      currentTier,
      subscription,
      isActive,
      isTrialing,
      customerId,
      billingApiConfigured,
      isLoading,
      error,
      createCheckoutSession,
      openPortal,
      syncCheckoutSession,
      refreshSubscription,
    ],
  );

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling(): BillingContextValue {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error("useBilling must be used within BillingProvider");
  return ctx;
}

/** Dev-only: reset local billing state */
export function resetLocalBillingCustomer() {
  clearStoredCustomerId();
}
