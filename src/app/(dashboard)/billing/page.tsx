import { useEffect, useMemo, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { BillingCard } from "./BillingCard";
import { UpgradeSection } from "./UpgradeCard";
import { PaymentForm } from "./PaymentForm";
import { BillingProvider, useBilling } from "./BillingProvider";
import { UsagePricingPanel } from "@/features/billing/UsagePricingPanel";
import { SecurityAuditChecklist } from "./SecurityAuditChecklist";
import { agentQuotaLabel } from "@/lib/monetization";
import { Crown, DollarSign, Shield, Zap } from "lucide-react";

const comparisonFeatures: { label: string; free: boolean; pro: boolean; enterprise: boolean }[] = [
  { label: "Live Tashi Vertex consensus", free: false, pro: true, enterprise: true },
  { label: "Production FoxMQ broker", free: false, pro: true, enterprise: true },
  { label: "Priority queue access", free: false, pro: true, enterprise: true },
  { label: "Custom battery mandates", free: false, pro: true, enterprise: true },
  { label: "Private Vertex clusters", free: false, pro: false, enterprise: true },
  { label: "24/7 mission-critical support", free: false, pro: false, enterprise: true },
];

const tierColumns = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    priceSuffix: "",
    agents: agentQuotaLabel("free"),
    recommended: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$99",
    priceSuffix: "/mo",
    agents: agentQuotaLabel("pro"),
    recommended: true,
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: "$999",
    priceSuffix: "/mo",
    agents: agentQuotaLabel("enterprise"),
    recommended: false,
  },
];

function TierComparison() {
  const { currentTier } = useBilling();

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card/20 ring-1 ring-border/40">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="w-[28%] p-4 text-left text-sm font-medium text-muted-foreground">Capability</th>
            {tierColumns.map((tier) => (
              <th
                key={tier.id}
                className={`p-6 text-left ${
                  currentTier === tier.id ? "bg-primary/5 ring-1 ring-primary/20" : ""
                }`}
              >
                <div className="text-center">
                  <div className="mb-2 flex items-center justify-center gap-2 text-xl font-bold text-foreground">
                    {tier.id === "enterprise" ? (
                      <Shield className="h-5 w-5 text-violet-400" />
                    ) : tier.id === "pro" ? (
                      <Zap className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <Crown className="h-5 w-5 text-muted-foreground" />
                    )}
                    {tier.name}
                  </div>
                  {tier.recommended && (
                    <Badge className="border border-emerald-500/50 bg-emerald-500/15 text-emerald-300">
                      Most popular
                    </Badge>
                  )}
                  <div className="mt-4 text-4xl font-black text-foreground">
                    {tier.price}
                    <span className="text-lg font-semibold text-muted-foreground">{tier.priceSuffix}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{tier.agents}</div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {comparisonFeatures.map((row) => (
            <tr key={row.label}>
              <td className="p-4 pl-6 text-sm text-muted-foreground">{row.label}</td>
              <td className="p-4 text-center text-lg">{row.free ? "✅" : "❌"}</td>
              <td className="p-4 text-center text-lg">{row.pro ? "✅" : "❌"}</td>
              <td className="p-4 text-center text-lg">{row.enterprise ? "✅" : "❌"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CheckoutSessionSync() {
  const searchStr = useRouterState({ select: (s) => s.location.search });
  const sessionId = useMemo(() => new URLSearchParams(searchStr).get("session_id"), [searchStr]);
  const { syncCheckoutSession } = useBilling();
  const ranForSession = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const stripSessionParam = () => {
      const u = new URL(window.location.href);
      u.searchParams.delete("session_id");
      window.history.replaceState({}, "", `${u.pathname}${u.search}`);
    };

    const dedupeKey = `tashi_billing_sync_${sessionId}`;
    try {
      if (sessionStorage.getItem(dedupeKey)) {
        stripSessionParam();
        return;
      }
      sessionStorage.setItem(dedupeKey, "1");
    } catch {
      if (ranForSession.current === sessionId) {
        stripSessionParam();
        return;
      }
      ranForSession.current = sessionId;
    }

    let alive = true;
    void syncCheckoutSession(sessionId).then(() => {
      if (!alive) return;
      stripSessionParam();
    });
    return () => {
      alive = false;
    };
  }, [sessionId, syncCheckoutSession]);

  return null;
}

function BillingPageInner() {
  return (
    <>
      <CheckoutSessionSync />
      <div className="mx-auto max-w-7xl space-y-8 p-0 sm:p-1">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mx-auto mb-8 inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-500 px-6 py-3 font-bold text-zinc-950 shadow-lg">
            <DollarSign className="h-5 w-5" />
            <span>Upgrade for production scale</span>
          </div>

          <h1 className="mb-4 bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
            Choose your plan
          </h1>
          <p className="mx-auto max-w-3xl text-lg text-muted-foreground sm:text-xl">
            From 100 agents (Free) to unlimited production swarms (Enterprise). Cancel anytime, upgrade instantly.
          </p>
        </motion.header>

        <BillingCard />

        <UsagePricingPanel />

        <SecurityAuditChecklist />

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Tier comparison</h2>
          <TierComparison />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Upgrade</h2>
          <UpgradeSection />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Payment method</h2>
          <PaymentForm />
        </div>
      </div>
    </>
  );
}

export default function BillingPage() {
  return (
    <BillingProvider>
      <BillingPageInner />
    </BillingProvider>
  );
}
