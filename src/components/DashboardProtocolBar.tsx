import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

type Props = {
  className?: string;
  /** Icon-first trigger for narrow headers */
  compact?: boolean;
};

/**
 * Dashboard header wallet entry: unified operator wallet modal plus quick link to on-chain staking.
 */
export function DashboardProtocolBar({ className, compact }: Props) {
  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="hidden h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground xl:inline-flex"
        asChild
      >
        <Link to="/dashboard/staking">
          <Coins className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Staking
        </Link>
      </Button>
      <ConnectWalletButton compact={compact} variant="outline" size={compact ? "icon" : "sm"} />
    </div>
  );
}
