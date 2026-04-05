import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useWarehouseRestockStore } from "@/store/warehouseRestockStore";

export default function PerformanceMetrics() {
  const restockRate = useWarehouseRestockStore((s) => s.restockRate);
  const staticRate = useWarehouseRestockStore((s) => s.staticRate);
  const speedupFactor = useWarehouseRestockStore((s) => s.speedupFactor);
  const totalRestocks = useWarehouseRestockStore((s) => s.totalRestocks);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.07] to-orange-500/[0.06] p-6 shadow-xl backdrop-blur-md sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-xl shadow-lg">🏆</div>
          <h3 className="bg-gradient-to-r from-emerald-400 to-orange-400 bg-clip-text text-2xl font-black text-transparent">
            Warehouse superiority
          </h3>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-6 text-center">
          <div>
            <div className="text-3xl font-black text-emerald-400 sm:text-4xl">{restockRate.toFixed(0)}/min</div>
            <div className="mt-1 text-sm text-zinc-400">Continuous replan swarm</div>
          </div>
          <div>
            <div className="text-3xl font-black text-zinc-500 sm:text-4xl">{staticRate.toFixed(0)}/min</div>
            <div className="mt-1 text-sm text-zinc-500">Static baseline (3.2× divisor)</div>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-emerald-500/35 bg-gradient-to-r from-emerald-500/15 to-orange-500/15 p-5 text-center">
          <div className="mb-2 text-3xl font-black text-emerald-400">{speedupFactor.toFixed(1)}× faster restocking</div>
          <Badge className="bg-emerald-600/90 font-bold text-white">Live KPI · {totalRestocks} picks</Badge>
          <p className="mt-3 text-xs text-zinc-400">Baseline models fixed-interval replanning vs 60fps mesh renegotiation around moving shelves.</p>
        </div>
      </div>
    </div>
  );
}

export function LiveRestockStats() {
  const totalRestocks = useWarehouseRestockStore((s) => s.totalRestocks);
  const replanTicks = useWarehouseRestockStore((s) => s.replanTicks);
  const running = useWarehouseRestockStore((s) => s.running);

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
      <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-400">Live restock stats</h4>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Total picks</dt>
          <dd className="font-mono text-orange-200">{totalRestocks}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Sim state</dt>
          <dd className="font-mono text-zinc-300">{running ? "RUNNING" : "PAUSED"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Replan ticks</dt>
          <dd className="font-mono text-zinc-300">{replanTicks.toLocaleString()}</dd>
        </div>
      </dl>
    </div>
  );
}

export function ShelfMovementTracker() {
  const shelfTravelAccum = useWarehouseRestockStore((s) => s.shelfTravelAccum);
  const chaos = useWarehouseRestockStore((s) => s.chaos);
  const shelves = useWarehouseRestockStore((s) => s.shelves);

  const moving = shelves.filter((s) => Math.abs(s.vx) > 0.02).length;
  const busy = shelves.filter((s) => s.inventory > 0).length;
  const pct = Math.min(100, (shelfTravelAccum / 480) * 100);

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
      <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-400">Shelf movement tracker</h4>
      <div className="mb-3 space-y-1 text-xs text-zinc-500">
        <p>
          Active movers: <span className="font-mono text-zinc-200">{moving}</span> / {shelves.length}
        </p>
        <p>
          Stocked aisles: <span className="font-mono text-zinc-200">{busy}</span> · chaos {chaos.toFixed(0)}
        </p>
      </div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Floor utilization pulse</p>
      <Progress value={pct} className="h-2 bg-zinc-800" />
      <p className="mt-2 text-[10px] text-zinc-600">Cumulative shelf travel (abstract units) — higher chaos drives faster Kiva-style drift.</p>
    </div>
  );
}
