import { useEffect, useState } from "react";
import { useConnect } from "wagmi";
import { AlertTriangle, FlaskConical, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useWallet } from "@/hooks/useWallet";
import { DemoWalletPersonaPicker } from "@/components/DemoWalletPersonaPicker";
import { WalletStatusCard } from "@/components/WalletStatusCard";
import { WalletHistoryPanel } from "@/components/WalletHistoryPanel";
import { DEFAULT_DEMO_PERSONA_ID, DEMO_NETWORK_LABELS, type DemoNetworkId } from "@/wallet/demoPersonas";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useWalletStore } from "@/wallet/walletStore";

export function WalletModal() {
  const {
    modalOpen,
    closeModal,
    connectDemo,
    connectInjected,
    isConnected,
    error,
    resetError,
    sessionRestoreStatus,
    clearStaleRealSession,
    connectionStatus,
    demoPersonaId,
    switchDemoPersona,
    setDemoNetwork,
    resetDemoIdentity,
    demoSeed,
    signReadiness,
    signatureHistory,
    transactionHistory,
    account,
  } = useWallet();

  const { connectors, reset } = useConnect();
  const [tab, setTab] = useState<"demo" | "real">("demo");
  const [persona, setPersona] = useState(demoPersonaId ?? DEFAULT_DEMO_PERSONA_ID);
  const [network, setNetwork] = useState<DemoNetworkId>("vertex-demo-network");
  const busy = connectionStatus === "connecting" || connectionStatus === "restoring";

  useEffect(() => {
    if (modalOpen && demoPersonaId) setPersona(demoPersonaId);
  }, [modalOpen, demoPersonaId]);

  const onDemoConnect = async () => {
    resetError();
    const ok = await connectDemo({ personaId: persona, networkId: network });
    if (ok) {
      toast.success("Demo operator wallet ready", {
        description: "Mock signatures and txs are labeled simulated — safe for judges.",
      });
    } else {
      const m = useWalletStore.getState().error?.message;
      if (m) toast.error(m);
    }
  };

  return (
    <Dialog
      open={modalOpen}
      onOpenChange={(o) => {
        if (!o) closeModal();
      }}
    >
      <DialogContent className="max-h-[min(90vh,720px)] max-w-2xl overflow-y-auto border-border/80 bg-background/95 p-0">
        <DialogHeader className="space-y-1 border-b border-border/60 px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" aria-hidden />
            Operator wallet
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Link a live browser wallet for staking, or use a deterministic demo operator for mission command, Lattice proofs,
            and Arc settlement previews without chain access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-6 pt-2" role="region" aria-label="Wallet connection">
          {sessionRestoreStatus === "stale" ? (
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-200" />
              <AlertTitle className="text-amber-50">Session needs reconnect</AlertTitle>
              <AlertDescription className="text-amber-50/90">
                A saved live session was found, but the browser wallet is not connected. Reconnect the same wallet, or clear
                the stale session.
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => clearStaleRealSession()}>
                    Clear saved session
                  </Button>
                  <Button type="button" size="sm" onClick={() => setTab("real")}>
                    Go to live wallet
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive" className="border-destructive/40">
              <AlertTitle>Wallet action blocked</AlertTitle>
              <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{error.message}</span>
                <Button type="button" size="sm" variant="outline" onClick={resetError}>
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <WalletStatusCard />

          {isConnected ? (
            <div className="space-y-3">
              <WalletHistoryPanel signatures={signatureHistory} transactions={transactionHistory} />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void signReadiness(
                    `Operator ${account?.address ?? ""} attests swarm readiness for Vertex-ordered mission command.`,
                  ).then(() => toast.message("Readiness signed", { description: "Added to coordination log." }))
                }
              >
                Sign mission readiness statement
              </Button>
            </div>
          ) : null}

          {!isConnected ? (
            <Tabs value={tab} onValueChange={(v) => setTab(v as "demo" | "real")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="demo" className="gap-1">
                  <FlaskConical className="h-3.5 w-3.5" aria-hidden />
                  Demo wallet
                </TabsTrigger>
                <TabsTrigger value="real">Live wallet</TabsTrigger>
              </TabsList>
              <TabsContent value="demo" className="mt-4 space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  One-click operator identity for hackathon judges — deterministic addresses, simulated signing, and Arc-style
                  settlement previews. Clearly labeled <span className="font-semibold text-amber-200">mock</span> everywhere.
                </p>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-50/95">
                  Demo seed (rotation resets address): <span className="font-mono">{demoSeed}</span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">Simulated mesh network</p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(DEMO_NETWORK_LABELS) as DemoNetworkId[]).map((id) => (
                      <Button
                        key={id}
                        type="button"
                        size="sm"
                        variant={network === id ? "default" : "outline"}
                        className={cn("font-mono text-[10px]", network === id && "bg-amber-600 hover:bg-amber-500")}
                        onClick={() => setNetwork(id)}
                      >
                        {id}
                      </Button>
                    ))}
                  </div>
                </div>
                <DemoWalletPersonaPicker value={persona} onChange={setPersona} disabled={busy} />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className="flex-1 min-w-[140px]" disabled={busy} onClick={() => void onDemoConnect()}>
                    {busy ? "Connecting…" : "Use demo wallet"}
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => resetDemoIdentity()}>
                    Reset demo seed
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="real" className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Connect MetaMask, Rabby, or another injected wallet. Supported networks for protocol UX: Ethereum mainnet,
                  Sepolia, and local Anvil.
                </p>
                <div className="flex flex-col gap-2" role="group" aria-label="Injected wallet connectors">
                  {connectors.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant="secondary"
                      disabled={!c.ready || busy}
                      className="justify-start gap-2 font-mono text-xs"
                      onClick={() => {
                        reset();
                        void connectInjected(c).then((ok) => {
                          if (ok) {
                            toast.success("Wallet connected", {
                              description: "Operator identity bound for missions & settlement.",
                            });
                          } else {
                            const m = useWalletStore.getState().error?.message;
                            if (m) toast.error(m);
                          }
                        });
                      }}
                    >
                      Connect {c.name}
                    </Button>
                  ))}
                  {connectors.length === 0 ? (
                    <p className="text-xs text-destructive">No injected wallet detected in this browser.</p>
                  ) : null}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3">
              <p className="text-xs font-medium text-foreground">Switch demo persona</p>
              <p className="text-[11px] text-muted-foreground">Mission ledger state is preserved; operator address updates for settlement.</p>
              <DemoWalletPersonaPicker
                value={account?.persona?.id ?? persona}
                onChange={(id) => void switchDemoPersona(id)}
                disabled={busy || !account?.isMock}
              />
              {account?.isMock ? (
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DEMO_NETWORK_LABELS) as DemoNetworkId[]).map((id) => (
                    <Button
                      key={id}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="font-mono text-[10px]"
                      disabled={busy}
                      onClick={() => void setDemoNetwork(id)}
                    >
                      {id}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
