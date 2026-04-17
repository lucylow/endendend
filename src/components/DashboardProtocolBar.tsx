import { Link } from "react-router-dom";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { mainnet, sepolia, localhost } from "wagmi/chains";
import { ChevronDown, Coins, LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { userFacingError } from "@/features/staking/errors";
import { toast } from "sonner";

function chainLabel(chainId: number | undefined) {
  if (chainId === mainnet.id) return "Mainnet";
  if (chainId === sepolia.id) return "Sepolia";
  if (chainId === localhost.id) return "Localhost";
  if (chainId == null) return "—";
  return `Chain ${chainId}`;
}

type Props = {
  className?: string;
  /** Icon-first trigger for narrow headers */
  compact?: boolean;
};

export function DashboardProtocolBar({ className, compact }: Props) {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, reset } = useConnect();
  const { disconnect, disconnectAsync } = useDisconnect();

  const network = chainLabel(isConnected ? chainId : undefined);

  if (!isConnected) {
    return (
      <div className={cn(className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size={compact ? "icon" : "sm"}
              className={cn(
                "shrink-0 border-border/80 bg-card/50 font-mono text-xs shadow-sm",
                !compact && "gap-2 px-3",
              )}
              aria-label="Connect wallet"
            >
              <Wallet className={cn("h-4 w-4 text-emerald-400", compact && "h-[1.15rem] w-[1.15rem]")} />
              {!compact && <span>Connect wallet</span>}
              {!compact && <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
              Injected wallets (MetaMask, Rabby, …)
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {connectors.length === 0 ? (
              <DropdownMenuItem disabled className="text-xs">
                No wallet detected
              </DropdownMenuItem>
            ) : (
              connectors.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  disabled={!c.ready || isPending}
                  className="font-mono text-xs"
                  onClick={() => {
                    reset();
                    connect(
                      { connector: c },
                      {
                        onError: (e) => toast.error(userFacingError(e)),
                      },
                    );
                  }}
                >
                  {isPending ? "Connecting…" : `Connect ${c.name}`}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <div
        className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/25 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
        title="Active network"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/40 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        {network}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={compact ? "icon" : "sm"}
            className={cn(
              "shrink-0 border-border/80 bg-card/50 font-mono text-xs shadow-sm",
              !compact && "gap-2 px-3 max-w-[11rem]",
            )}
            aria-label="Wallet menu"
          >
            <Wallet className={cn("h-4 w-4 shrink-0 text-emerald-400", compact && "h-[1.15rem] w-[1.15rem]")} />
            {!compact && <span className="truncate">{shortAddr}</span>}
            {!compact && <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="space-y-1 font-normal">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Connected</span>
            <p className="break-all font-mono text-xs text-foreground">{address}</p>
          </DropdownMenuLabel>
          <div className="px-2 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Network · {chainLabel(chainId)}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/dashboard/staking" className="flex cursor-pointer items-center gap-2 font-mono text-xs">
              <Coins className="h-3.5 w-3.5" />
              Staking & rewards
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 font-mono text-xs text-destructive focus:text-destructive"
            onClick={() => {
              void disconnectAsync().catch(() => disconnect());
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
