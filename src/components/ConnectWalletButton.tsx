import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWallet } from "@/hooks/useWallet";

type Props = {
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  /** Icon-only trigger for dense headers */
  compact?: boolean;
};

/**
 * Primary entry point for the wallet subsystem: opens the unified connect / demo modal.
 */
export function ConnectWalletButton({ className, variant = "outline", size = "sm", compact }: Props) {
  const { openModal, isConnected, account, connectionStatus, resetError, modalOpen } = useWallet();
  const loading = connectionStatus === "connecting" || connectionStatus === "restoring";

  const statusLabel = !isConnected
    ? "Disconnected"
    : account?.isMock
      ? "Demo wallet connected"
      : "Live wallet connected";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="sr-only" role="status">
        {statusLabel}
        {loading ? " — working" : ""}
      </span>
      {isConnected ? (
        <Badge
          variant="outline"
          className={cn(
            "hidden font-mono text-[10px] uppercase tracking-wide sm:inline-flex",
            account?.isMock ? "border-amber-500/50 text-amber-200" : "border-emerald-500/40 text-emerald-200",
          )}
        >
          <span className="sr-only">{statusLabel}: </span>
          {account?.isMock ? "Mock" : "Live"}
        </Badge>
      ) : (
        <Badge variant="secondary" className="hidden font-mono text-[10px] uppercase tracking-wide sm:inline-flex">
          <span className="sr-only">{statusLabel}</span>
          Off-net
        </Badge>
      )}
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn("gap-2 font-medium", compact && "px-2")}
        aria-haspopup="dialog"
        aria-expanded={modalOpen}
        disabled={loading}
        onClick={() => {
          resetError();
          openModal();
        }}
      >
        <Wallet className={cn("h-4 w-4 shrink-0", account?.isMock ? "text-amber-300" : "text-emerald-400")} aria-hidden />
        {!compact && <span>{isConnected ? "Wallet" : "Connect wallet"}</span>}
      </Button>
    </div>
  );
}
