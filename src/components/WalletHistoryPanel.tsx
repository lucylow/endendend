import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { SignatureRecord, TransactionRecord } from "@/wallet/types";
import { cn } from "@/lib/utils";

type Props = {
  signatures: SignatureRecord[];
  transactions: TransactionRecord[];
  className?: string;
};

export function WalletHistoryPanel({ signatures, transactions, className }: Props) {
  const empty = signatures.length === 0 && transactions.length === 0;
  return (
    <div className={cn("rounded-xl border border-border/70 bg-muted/15", className)}>
      <div className="border-b border-border/60 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coordination log</h3>
        <p className="text-[11px] text-muted-foreground">Signatures and simulated txs for mission command &amp; Arc previews.</p>
      </div>
      {empty ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">No signatures yet — sign readiness or a settlement preview.</p>
      ) : (
        <ScrollArea className="h-48 pr-2">
          <ul className="space-y-2 p-3 text-xs">
            {signatures.map((s) => (
              <li key={s.id} className="rounded-lg border border-border/50 bg-background/40 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {s.purpose.replace(/_/g, " ")}
                  </Badge>
                  {s.simulated ? (
                    <Badge className="bg-amber-500/15 text-amber-100 border-amber-500/30 font-mono text-[10px]">Simulated sig</Badge>
                  ) : (
                    <Badge className="bg-emerald-500/15 text-emerald-100 border-emerald-500/30 font-mono text-[10px]">On-chain sig</Badge>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    {new Date(s.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 font-mono text-[10px] text-muted-foreground">{s.signedMessage}</p>
                <p className="mt-1 truncate font-mono text-[10px] text-foreground/80" title={s.signature}>
                  {s.signature}
                </p>
              </li>
            ))}
            {transactions.map((t) => (
              <li key={t.id} className="rounded-lg border border-border/50 bg-background/40 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    Tx
                  </Badge>
                  {t.simulated ? (
                    <Badge className="bg-amber-500/15 text-amber-100 border-amber-500/30 font-mono text-[10px]">Simulated tx</Badge>
                  ) : (
                    <Badge className="bg-cyan-500/15 text-cyan-100 border-cyan-500/30 font-mono text-[10px]">Broadcast</Badge>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    {new Date(t.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-[10px] text-foreground/90">{t.txHash}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">→ {t.destination}</p>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
