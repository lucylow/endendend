import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SettlementPreview as Preview } from "@/wallet/types";
import { cn } from "@/lib/utils";
import { ShieldCheck, Sparkles } from "lucide-react";

type Props = {
  preview: Preview | null;
  missionId?: string;
  onSign?: () => void;
  signing?: boolean;
  className?: string;
};

export function SettlementPreview({ preview, missionId, onSign, signing, className }: Props) {
  if (!preview) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        <p>No Arc settlement preview yet. Complete a mission to terminal phase or load an outcome packet.</p>
        {missionId ? <p className="mt-2 font-mono text-xs text-foreground/70">Mission {missionId}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border/70 bg-card/40 p-4 shadow-sm", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
            Arc settlement preview
          </div>
          <p className="text-xs text-muted-foreground">Proof-of-coordination bundle before public finality.</p>
        </div>
        {preview.simulated ? (
          <Badge className="bg-amber-500/15 font-mono text-[10px] uppercase tracking-wide text-amber-100 border border-amber-500/35">
            Simulated
          </Badge>
        ) : (
          <Badge className="bg-emerald-500/15 font-mono text-[10px] uppercase tracking-wide text-emerald-100 border border-emerald-500/35">
            Live path
          </Badge>
        )}
      </div>
      <dl className="mt-4 grid gap-2 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Artifact</dt>
          <dd className="font-mono text-right text-foreground/90">{preview.artifactId}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Operator</dt>
          <dd className="max-w-[14rem] truncate font-mono text-right text-foreground/90" title={preview.operatorAddress}>
            {preview.operatorAddress}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">Payload hash</dt>
          <dd className="break-all font-mono text-[10px] text-foreground/85">{preview.payloadHash}</dd>
        </div>
      </dl>
      {preview.mockReceipt ? (
        <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-[11px] text-amber-50/95">
          <div className="flex items-center gap-1 font-medium">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Mock mission completion certificate
          </div>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed">
            {JSON.stringify(preview.mockReceipt, null, 2)}
          </pre>
        </div>
      ) : preview.signedAt ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Signed at {new Date(preview.signedAt).toLocaleString()} — check your wallet for the attestation record.
        </p>
      ) : null}
      {onSign ? (
        <Button type="button" className="mt-4 w-full" disabled={signing || Boolean(preview.signedAt)} onClick={onSign}>
          {signing ? "Signing…" : preview.simulated ? "Sign simulated settlement" : "Sign settlement commitment"}
        </Button>
      ) : null}
    </div>
  );
}
