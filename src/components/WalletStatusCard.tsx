import { Copy, LogOut, User, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useWallet } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";

type Props = { className?: string };

export function WalletStatusCard({ className }: Props) {
  const { account, session, disconnect, connectionStatus } = useWallet();
  const busy = connectionStatus === "disconnecting";

  if (!account) {
    return (
      <div className={cn("rounded-xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground", className)}>
        Connect a wallet to bind operator identity for mission command, relay attestations, and Arc settlement previews.
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(account.address);
      toast.success("Operator address copied");
    } catch {
      toast.error("Could not copy address");
    }
  };

  return (
    <div className={cn("rounded-xl border border-border/70 bg-card/50 p-4 shadow-sm", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-foreground">{account.displayName}</p>
            <p className="text-xs text-muted-foreground">{account.persona?.roleLabel ?? "Wallet operator"}</p>
          </div>
        </div>
        {account.isMock ? (
          <Badge className="border border-amber-500/40 bg-amber-500/15 font-mono text-[10px] uppercase tracking-wide text-amber-100">
            Demo wallet
          </Badge>
        ) : (
          <Badge className="border border-emerald-500/40 bg-emerald-500/15 font-mono text-[10px] uppercase tracking-wide text-emerald-100">
            Live wallet
          </Badge>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1 font-mono text-muted-foreground">
          <Wifi className="h-3.5 w-3.5 text-foreground" aria-hidden />
          <span className="sr-only">Network: </span>
          {account.chainLabel}
        </span>
        {session ? (
          <span className="rounded-md border border-border/60 px-2 py-1 font-mono text-[10px] text-muted-foreground">
            Session {session.sessionId.slice(0, 8)}…
          </span>
        ) : null}
      </div>
      <p className="mt-2 break-all font-mono text-[11px] text-foreground/90">{account.address}</p>
      {account.isMock && account.persona ? (
        <p className="mt-2 text-[11px] text-amber-100/90">
          Demo balance (not real funds): <span className="font-mono">{account.persona.mockBalance}</span>
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" className="gap-1" onClick={() => void copy()}>
          <Copy className="h-3.5 w-3.5" aria-hidden />
          Copy address
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" disabled={busy} onClick={() => void disconnect()}>
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          Disconnect
        </Button>
      </div>
    </div>
  );
}
