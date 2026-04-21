import type { AuctionState } from "@/stores/swarmStore";

export function AuctionTable({ auction }: { auction: AuctionState }) {
  const bidRows = Object.entries(auction.bids);
  return (
    <div className="pointer-events-none max-w-md rounded-lg border border-border/60 bg-black/55 p-3 font-mono text-xs text-white backdrop-blur">
      <div className="text-[11px] text-slate-300">Auction (P2P Vertex mock)</div>
      <div>
        {auction.active ? <span className="text-rose-300">bidding…</span> : <span className="text-slate-400">idle</span>}{" "}
        {auction.winner ? <span className="text-amber-300">winner {auction.winner}</span> : null}
      </div>
      {bidRows.length ? (
        <ul className="mt-2 space-y-1 text-[11px]">
          {bidRows.map(([id, b]) => (
            <li key={id}>
              {id}: score {Number.isFinite(b?.score) ? b.score.toFixed(3) : "—"} @{" "}
              {Number.isFinite(b?.distance) ? b.distance.toFixed(1) : "—"}m
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 text-muted-foreground">Awaiting rover bids</div>
      )}
    </div>
  );
}
