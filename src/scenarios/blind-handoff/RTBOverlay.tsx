import { useMemo } from "react";
import { useSwarmStore } from "@/stores/swarmStore";

export function RTBOverlay() {
  const aerial = useSwarmStore((s) => s.aerial);
  const cycleT = useSwarmStore((s) => s.cycleT);
  const timeline = useSwarmStore((s) => s.timeline);

  const visible = useMemo(() => {
    if (!aerial || aerial.mode !== "rtb") return false;
    const t0 = timeline?.winner_s ?? 20;
    const t1 = timeline?.rtb_done_s ?? 27;
    return cycleT >= t0 && cycleT < t1;
  }, [aerial, cycleT, timeline]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-20 max-w-sm rounded-lg border border-amber-500/40 bg-amber-950/70 px-3 py-2 text-xs text-amber-50 shadow-lg backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">Return to base</div>
      <div className="mt-1 font-mono text-[11px] text-amber-100/95">
        Aerial conserving energy — RTB while ground unit closes on victim.
      </div>
    </div>
  );
}
