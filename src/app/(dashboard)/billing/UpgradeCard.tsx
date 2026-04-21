import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, ShieldCheck, Zap } from "lucide-react";
import { useBilling } from "@/features/billing/useBilling";
import { isHostedIntegrationPreview } from "@/lib/integration/hostedPreview";
import { agentQuotaLabel } from "@/lib/monetization";

interface Tier {
  id: "pro" | "enterprise";
  name: string;
  price: string;
  priceSuffix: string;
  agents: string;
  features: string[];
  recommended?: boolean;
}

const tiers: Tier[] = [
  {
    id: "pro",
    name: "Pro",
    price: "99",
    priceSuffix: "/mo",
    agents: `${agentQuotaLabel("pro")} agent IDs`,
    features: [
      "Live Vertex consensus",
      "Production FoxMQ",
      "Priority support SLA",
      "Custom mandates",
    ],
    recommended: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "999",
    priceSuffix: "/mo",
    agents: "Unlimited",
    features: [
      "Private Vertex clusters",
      "On-premise deployment",
      "24/7 mission support",
      "Custom integrations",
    ],
  },
];

export function UpgradeSection() {
  const { createCheckoutSession, currentTier, publishableKeyConfigured, billingApiConfigured } = useBilling();
  const preview = isHostedIntegrationPreview();

  return (
    <div className="space-y-4">
      {(!billingApiConfigured || !publishableKeyConfigured) && preview && (
        <p className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-4 py-3 text-center text-sm text-sky-100/95">
          This Lovable / static preview does not ship the Node billing server. Plans and pricing below are accurate; live checkout runs once you set{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">VITE_BILLING_API_URL</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">VITE_STRIPE_PUBLISHABLE_KEY</code>, and{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">npm run billing-server</code> (or your own API) behind the same origin or CORS.
        </p>
      )}
      {(!billingApiConfigured || !publishableKeyConfigured) && !preview && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
          Billing API or Stripe publishable key is not configured. Set server env and{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">VITE_STRIPE_PUBLISHABLE_KEY</code>, then run{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">npm run billing-server</code> with Vite proxy.
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {tiers.map((tier) => (
          <Card
            key={tier.id}
            className={`group border-2 transition-all duration-300 hover:shadow-2xl ${
              tier.recommended
                ? "border-emerald-500/80 bg-emerald-500/[0.06] ring-4 ring-emerald-500/15 hover:shadow-emerald-500/10"
                : "border-border hover:border-muted-foreground/30 hover:shadow-lg"
            }`}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                {tier.recommended ? (
                  <Crown className="h-8 w-8 shrink-0 text-emerald-400" />
                ) : (
                  <Zap className="h-6 w-6 shrink-0 text-muted-foreground" />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  {tier.recommended && (
                    <Badge className="border border-emerald-500/50 bg-emerald-500/15 text-emerald-300">Most popular</Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pb-8">
              <div className="text-center">
                <div className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-5xl font-black text-transparent">
                  ${tier.price}
                </div>
                <div className="text-2xl font-bold text-muted-foreground">{tier.priceSuffix}</div>
                <div className="mt-2 text-lg text-muted-foreground">{tier.agents}</div>
              </div>

              <ul className="space-y-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-muted-foreground">
                    <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                type="button"
                onClick={() => void createCheckoutSession(tier.id)}
                size="lg"
                disabled={!publishableKeyConfigured || !billingApiConfigured}
                className="h-14 w-full text-xl font-bold shadow-xl transition-shadow group-hover:shadow-emerald-500/20"
              >
                {currentTier === tier.id ? "Manage plan" : `Upgrade to ${tier.name}`}
              </Button>

              <p className="text-center text-xs text-muted-foreground">Billed monthly. Cancel anytime.</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
