import { useSwarmStore } from "@/stores/swarmStore";

export default function LiveDashboard() {
  const scenario = useSwarmStore((s) => s.scenario);
  const time = useSwarmStore((s) => s.time);
  const reallocated = useSwarmStore((s) => s.reallocated);
  const rovers = useSwarmStore((s) => s.rovers);
  const rescues = useSwarmStore((s) => s.rescues_completed);
  const auction = useSwarmStore((s) => s.auction);
  const tunnelDepth = useSwarmStore((s) => s.tunnelDepth);
  const relayChain = useSwarmStore((s) => s.relayChain);
  const globalMap = useSwarmStore((s) => s.globalMap);

  const liveCells =
    globalMap.length > 0
      ? globalMap.reduce((acc, row) => acc + row.filter((c) => c > 0).length, 0)
      : 0;

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-40 w-[min(96vw,36rem)] -translate-x-1/2 rounded-xl border border-border bg-background/90 px-4 py-3 text-xs text-foreground shadow-lg backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono uppercase text-muted-foreground">Scenario</span>
        <span className="rounded-md bg-muted px-2 py-0.5 font-semibold">{scenario}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11px] sm:grid-cols-3">
        <div>
          <span className="text-muted-foreground">T+</span> {time.toFixed(1)}s
        </div>
        <div>
          <span className="text-muted-foreground">Rovers</span> {rovers.length}
        </div>
        <div>
          <span className="text-muted-foreground">Map cells</span> {liveCells}
        </div>
        <div>
          <span className="text-muted-foreground">Realloc</span> {reallocated ? "yes" : "no"}
        </div>
        <div>
          <span className="text-muted-foreground">Rescues</span> {rescues}
        </div>
        <div>
          <span className="text-muted-foreground">Auction</span>{" "}
          {auction.active ? "active" : "idle"}
        </div>
        <div>
          <span className="text-muted-foreground">Tunnel</span> {tunnelDepth.toFixed(1)}m
        </div>
        <div className="sm:col-span-2">
          <span className="text-muted-foreground">Relay</span>{" "}
          {relayChain.length ? relayChain.join(" → ") : "—"}
        </div>
      </div>
    </div>
  );
}
