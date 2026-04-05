import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, ChevronDown, X } from "lucide-react";
import { useState } from "react";
import type { MatrixFeature, MatrixTier } from "./types";
import { FeatureToggle } from "./FeatureToggle";

interface FeatureMatrixTableProps {
  features: MatrixFeature[];
}

const tierOrder: MatrixTier[] = ["free", "pro", "enterprise"];

function tierLabel(t: MatrixTier) {
  if (t === "free") return "Free";
  if (t === "pro") return "Pro";
  return "Enterprise";
}

function hasFeature(f: MatrixFeature, t: MatrixTier) {
  if (t === "free") return f.free;
  if (t === "pro") return f.pro;
  return f.enterprise;
}

function CellIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center justify-center text-emerald-400" title="Included">
      <Check className="h-5 w-5" strokeWidth={2.25} aria-hidden />
      <span className="sr-only">Included</span>
    </span>
  ) : (
    <span className="inline-flex items-center justify-center text-zinc-600" title="Not included">
      <X className="h-5 w-5 opacity-70" strokeWidth={2} aria-hidden />
      <span className="sr-only">Not included</span>
    </span>
  );
}

export default function FeatureMatrixTable({ features }: FeatureMatrixTableProps) {
  const [annual, setAnnual] = useState(false);

  const tiers: {
    id: MatrixTier;
    price: string;
    agents: string;
    popular?: boolean;
  }[] = [
    { id: "free", price: "$0", agents: "Up to 100 agents / mo" },
    { id: "pro", price: annual ? "$79" : "$99", agents: "10K telemetry events / mo", popular: true },
    { id: "enterprise", price: annual ? "$799" : "$999", agents: "Unlimited fleet · SLA" },
  ];

  return (
    <div className="lg:sticky lg:top-24 lg:self-start">
      <FeatureToggle annual={annual} onAnnualChange={setAnnual} />

      {/* Desktop matrix */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/[0.08]">
              <th className="p-4 sm:p-6 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground w-[32%]">
                Capability
              </th>
              {tiers.map((tier) => (
                <th key={tier.id} className="p-4 sm:p-6 text-center align-bottom border-l border-white/[0.06]">
                  <div className="space-y-2">
                    <div className="font-bold text-base sm:text-lg text-foreground">{tierLabel(tier.id)}</div>
                    {tier.popular && (
                      <Badge className="bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20">
                        Most popular
                      </Badge>
                    )}
                    <div className="text-2xl sm:text-3xl font-bold text-gradient-hero tabular-nums">{tier.price}</div>
                    <div className="text-xs text-muted-foreground leading-snug max-w-[140px] mx-auto">{tier.agents}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {features.map((feature) => (
              <tr key={feature.title} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-4 sm:p-5 font-medium text-foreground/90 text-left">{feature.title}</td>
                {tierOrder.map((t) => (
                  <td key={t} className="p-4 sm:p-5 text-center border-l border-white/[0.05]">
                    <div className="flex justify-center">
                      <CellIcon ok={hasFeature(feature, t)} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile collapsible by tier */}
      <div className="md:hidden space-y-3">
        {tiers.map((tier) => (
          <Collapsible
            key={tier.id}
            defaultOpen={tier.popular}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03]"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-4 text-left [&[data-state=open]_svg]:rotate-180">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{tierLabel(tier.id)}</span>
                  {tier.popular && (
                    <Badge className="bg-emerald-500/15 border-emerald-500/40 text-emerald-300 text-[10px] px-2 py-0">
                      Popular
                    </Badge>
                  )}
                </div>
                <div className="text-lg font-bold text-gradient-hero mt-1">{tier.price}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{tier.agents}</p>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="border-t border-white/[0.06] px-4 py-3 space-y-2.5">
                {features.map((f) => (
                  <li key={f.title} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-muted-foreground pr-2">{f.title}</span>
                    <CellIcon ok={hasFeature(f, tier.id)} />
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
