import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBilling } from "@/features/billing/useBilling";
import { agentQuotaLabel } from "@/lib/monetization";
import { DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function BillingCard() {
  const { subscription, isActive, isTrialing, currentTier, openPortal, isLoading, customerId } = useBilling();

  if (isLoading && customerId) {
    return (
      <Card className="border-border bg-card/40 shadow-xl ring-1 ring-border/50">
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card className="border-border bg-card/30 ring-1 ring-border/40">
        <CardContent className="py-16 text-center">
          <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-muted to-muted/40">
            <DollarSign className="h-14 w-14 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-2xl font-bold text-foreground">Free plan</h3>
          <p className="mx-auto mb-2 max-w-md text-muted-foreground">
            You are on the Free plan ({agentQuotaLabel("free")} agent identities). Upgrade for live Vertex consensus,
            production FoxMQ, and priority support.
          </p>
        </CardContent>
      </Card>
    );
  }

  const unit = subscription.items.data[0]?.price.unit_amount;
  const monthly = unit != null ? (unit / 100).toFixed(0) : "—";

  return (
    <Card className="border-border bg-card/40 shadow-xl ring-1 ring-border/50">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex flex-wrap items-center gap-3 text-2xl">
            Current plan
            <Badge className="border border-emerald-500/50 bg-emerald-500/15 px-3 py-1 text-emerald-300">
              {currentTier.toUpperCase()}
            </Badge>
          </CardTitle>
          <Badge
            className={
              isActive
                ? "bg-emerald-600 text-white"
                : isTrialing
                  ? "bg-sky-600 text-white"
                  : "bg-amber-600 text-white"
            }
          >
            {isActive ? "Active" : isTrialing ? "Trialing" : subscription.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
          <div>
            <div className="text-2xl font-bold text-emerald-400">
              {subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toLocaleDateString()
                : "—"}
            </div>
            <p className="text-sm text-muted-foreground">Renews / ends</p>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">${monthly}</div>
            <p className="text-sm text-muted-foreground">Monthly</p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => void openPortal()}
          className="h-12 w-full text-lg font-semibold shadow-lg"
          variant="secondary"
        >
          Manage billing (Stripe portal)
        </Button>
      </CardContent>
    </Card>
  );
}
