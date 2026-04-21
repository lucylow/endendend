import type { AuctionState } from "@/stores/swarmStore";
import { AuctionTable } from "./AuctionTable";

export function SidePanel({
  battery,
  auction,
  rescues,
  groundCount,
}: {
  battery: number;
  auction: AuctionState;
  rescues: number;
  groundCount: number;
}) {
  return (
    <div className="pointer-events-none absolute left-4 top-4 z-10 flex max-w-md flex-col gap-2">
      <div className="rounded-lg border border-border/60 bg-black/55 p-3 font-mono text-xs text-white backdrop-blur">
        <div className="text-[11px] text-slate-300">Aerial battery</div>
        <div className="text-lg font-semibold">{Number.isFinite(battery) ? battery.toFixed(0) : "—"}%</div>
        <div className="mt-2 text-[11px] text-slate-300">Rescues completed</div>
        <div className="text-base font-semibold text-emerald-300">{rescues}</div>
        <div className="mt-1 text-[11px] text-slate-400">Ground nodes: {groundCount}</div>
      </div>
      <AuctionTable auction={auction} />
    </div>
  );
}
