import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet } from "@/hooks/useWallet";
import { useRuntimeStore } from "@/lib/state/runtimeStore";
import { toast } from "sonner";

export function WalletPanel() {
  const { account, isConnected, openModal, connectDemo, disconnect, connectionStatus, signReadiness } = useWallet();
  const signMock = useRuntimeStore((s) => s.signMockReadiness);
  const refreshFromLocal = useRuntimeStore((s) => s.refreshFromLocal);
  const busy = connectionStatus === "connecting" || connectionStatus === "restoring";

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Operator wallet</CardTitle>
        <CardDescription className="text-xs">
          Same wallet center as the dashboard: live injected wallet or deterministic mock operator for Arc settlement
          previews.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => openModal()}>
            Wallet center
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void connectDemo().then((ok) => {
                if (ok) {
                  toast.success("Demo wallet bound to workspace");
                  refreshFromLocal();
                } else toast.error("Demo wallet failed to start");
              })
            }
          >
            Quick demo connect
          </Button>
          <Button size="sm" variant="ghost" disabled={busy || !isConnected} onClick={() => void disconnect()}>
            Disconnect
          </Button>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2 font-mono text-[11px]">
          {!isConnected || !account ? (
            <p className="text-zinc-500">No operator wallet — connect to bind mission command identity.</p>
          ) : (
            <>
              <div>
                <span className="text-zinc-500">mode </span>
                {account.isMock ? <span className="text-amber-300">mock demo</span> : <span className="text-emerald-300">live</span>}
              </div>
              <div className="truncate text-emerald-400/90">{account.address}</div>
              <div className="text-zinc-500">{account.chainLabel}</div>
            </>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={!isConnected}
          onClick={() =>
            void signReadiness(
              `Operator ${account?.address ?? ""} attests swarm readiness for Vertex-ordered mission command.`,
            ).then(() => {
              signMock("mission_ready");
              toast.message("Readiness recorded", { description: "Runtime log + wallet coordination signature." });
            })
          }
        >
          Sign readiness (wallet + mission log)
        </Button>
      </CardContent>
    </Card>
  );
}
