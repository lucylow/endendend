import { Button } from "@/components/ui/button";
import { Wallet, FlaskConical } from "lucide-react";
import { useConnect } from "wagmi";
import { userFacingError } from "@/features/staking/errors";
import { toast } from "sonner";
import { useWallet } from "@/hooks/useWallet";

export function ConnectWalletCTA() {
  const { connect, connectors, isPending, error, reset } = useConnect();
  const { openModal, connectDemo } = useWallet();

  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
      <Wallet className="mx-auto mb-4 h-12 w-12 text-emerald-400/90" />
      <h3 className="mb-2 text-lg font-semibold text-foreground">Connect a wallet</h3>
      <p className="mb-6 text-sm text-muted-foreground">
        Link an injected wallet (MetaMask, Rabby, etc.) to stake $TASHI on-chain. For SAR demos without chain access, use
        the operator demo wallet — same modal as the rest of the control plane.
      </p>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="secondary"
          className="gap-2 border border-amber-500/30 bg-amber-500/10 text-amber-50 hover:bg-amber-500/15"
          onClick={() => {
            void connectDemo().then((ok) => {
              if (ok) toast.success("Demo operator wallet connected");
              else toast.error("Could not start demo wallet");
            });
          }}
        >
          <FlaskConical className="h-4 w-4 shrink-0" aria-hidden />
          Use demo operator wallet
        </Button>
        <Button type="button" variant="outline" onClick={() => openModal()}>
          Open wallet center
        </Button>
      </div>
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
