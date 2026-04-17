import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { useConnect } from "wagmi";
import { userFacingError } from "@/features/staking/errors";
import { toast } from "sonner";

export function ConnectWalletCTA() {
  const { connect, connectors, isPending, error, reset } = useConnect();

  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
      <Wallet className="mx-auto mb-4 h-12 w-12 text-emerald-400/90" />
      <h3 className="mb-2 text-lg font-semibold text-foreground">Connect a wallet</h3>
      <p className="mb-6 text-sm text-muted-foreground">
        Link an injected wallet (MetaMask, Rabby, etc.) to stake $TASHI on-chain. In development, you can explore the
        dashboard without a wallet using mock stats.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center" role="group" aria-label="Wallet connectors">
        {connectors.map((c) => (
          <Button
            key={c.id}
            type="button"
            disabled={!c.ready || isPending}
            variant={c.ready ? "default" : "secondary"}
            className="bg-gradient-to-r from-emerald-600 to-cyan-600 font-semibold hover:from-emerald-500 hover:to-cyan-500"
            aria-busy={isPending}
            onClick={() => {
              reset();
              connect(
                { connector: c },
                {
                  onError: (e) => {
                    toast.error(userFacingError(e));
                  },
                },
              );
            }}
          >
            {isPending ? "Connecting…" : `Connect ${c.name}`}
          </Button>
        ))}
      </div>
      {connectors.length === 0 && (
        <p className="mt-4 text-xs text-muted-foreground">No browser wallet detected. Install a Web3 wallet extension.</p>
      )}
      {error ? (
        <div className="mt-4 space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-sm text-destructive">
          <p className="text-xs leading-relaxed" role="alert">
            {userFacingError(error)}
          </p>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => reset()}>
            Dismiss
          </Button>
        </div>
      ) : null}
    </div>
  );
}
