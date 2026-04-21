import { memo } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { chrome } from "@/lib/design-tokens";

export const RelayChain = memo(function RelayChain({
  orderedIds,
  explorerId,
  reducedMotion,
}: {
  orderedIds: string[];
  explorerId: string | null;
  reducedMotion?: boolean;
}) {
  if (!orderedIds.length) {
    return <p className="text-xs text-muted-foreground">No relay chain snapshot yet.</p>;
  }
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-lg border border-zinc-800/90 bg-zinc-950/60 px-3 py-2",
        !reducedMotion && "motion-safe:animate-in motion-safe:fade-in-0 duration-300",
      )}
      role="list"
      aria-label="Relay chain order"
    >
      {orderedIds.map((id, i) => {
        const isExplorer = explorerId != null && id === explorerId;
        return (
          <div key={`${id}-${i}`} className="flex items-center gap-1" role="listitem">
            {i > 0 ? (
              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0 text-cyan-500/80",
                  !reducedMotion && "motion-safe:animate-pulse",
                )}
                aria-hidden
              />
            ) : null}
            <Badge
              variant={isExplorer ? "default" : "secondary"}
              className={cn("font-mono text-[10px]", isExplorer && "ring-1 ring-cyan-400/60", chrome.focusRing)}
            >
              {id.replace(/^agent-/, "")}
              {isExplorer ? " · explorer" : ""}
            </Badge>
          </div>
        );
      })}
    </div>
  );
});
