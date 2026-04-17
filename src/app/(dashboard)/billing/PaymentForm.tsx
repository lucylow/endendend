import { useEffect, useState } from "react";
import { PaymentElement, useElements, useStripe, Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBilling } from "@/features/billing/useBilling";
import { billingFetchPath, parseJsonResponse } from "@/features/billing/stripeConfig";
import { toast } from "sonner";

const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = pk ? loadStripe(pk) : null;

function InnerPaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    try {
      const { error } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/billing`,
        },
      });
      if (error) toast.error(error.message ?? "Setup failed");
      else toast.success("Payment method saved");
    } catch (err) {
      if (import.meta.env.DEV) console.error("[billing] confirmSetup", err);
      toast.error(err instanceof Error ? err.message : "Setup failed unexpectedly");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || busy} className="w-full">
        {busy ? "Saving…" : "Save payment method"}
      </Button>
    </form>
  );
}

export function PaymentForm() {
  const { customerId, publishableKeyConfigured, billingApiConfigured } = useBilling();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId || !publishableKeyConfigured || !billingApiConfigured || !stripePromise) {
      setClientSecret(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(billingFetchPath("/api/billing/setup-intent"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId }),
        });
        const data = await parseJsonResponse<{ clientSecret?: string; error?: string }>(res);
        if (!res.ok) {
          if (!cancelled) toast.error(typeof data.error === "string" ? data.error : "Could not start card setup");
          return;
        }
        if (!data.clientSecret) {
          if (!cancelled) toast.error("No client secret returned from billing API");
          return;
        }
        if (!cancelled) setClientSecret(data.clientSecret);
      } catch (err) {
        if (import.meta.env.DEV) console.error("[billing] setup-intent", err);
        if (!cancelled) {
          toast.error(err instanceof TypeError ? "Network error" : err instanceof Error ? err.message : "Could not start card setup");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId, publishableKeyConfigured, billingApiConfigured]);

  if (!stripePromise || !publishableKeyConfigured) {
    return (
      <Card className="border-border bg-card/30">
        <CardHeader>
          <CardTitle>Payment method</CardTitle>
          <CardDescription>Set VITE_STRIPE_PUBLISHABLE_KEY to enable Stripe Elements.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!customerId) {
    return (
      <Card className="border-border bg-card/30">
        <CardHeader>
          <CardTitle>Payment method</CardTitle>
          <CardDescription>Complete a subscription checkout first; then you can add or rotate cards here.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading || !clientSecret) {
    return (
      <Card className="border-border bg-card/30">
        <CardHeader>
          <CardTitle>Payment method</CardTitle>
          <CardDescription>Secure card capture via Stripe Elements.</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/40 ring-1 ring-border/50">
      <CardHeader>
        <CardTitle>Payment method</CardTitle>
        <CardDescription>
          Add or update the card on file (SetupIntent + Payment Element). Issuers may challenge with 3D Secure (SCA)
          when required; high-value or high-risk payments typically see stronger authentication.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
          <InnerPaymentForm />
        </Elements>
      </CardContent>
    </Card>
  );
}
