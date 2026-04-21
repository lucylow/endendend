import { useSwarmStore } from "@/stores/swarmStore";

export function FailureOverlay() {
  const rovers = useSwarmStore((s) => s.rovers);
  const time = useSwarmStore((s) => s.time);
  const b = rovers.find((r) => r.id === "RoverB");
  const c = rovers.find((r) => r.id === "RoverC");
  const bDead = b?.state === "dead";
  const cDead = c?.state === "dead";
  const hbLoss = b && !bDead && time >= 30 && time < 33;

  return (
    <div className="pointer-events-none absolute right-4 top-24 z-10 max-w-sm space-y-2 text-right font-mono text-sm text-white drop-shadow-md">
      {hbLoss ? (
        <div className="rounded-md border border-amber-500/60 bg-amber-950/80 px-3 py-2 text-amber-100">
          Heartbeat loss: RoverB (T+{time.toFixed(1)}s) — detecting…
        </div>
      ) : null}
      {bDead ? (
        <div className="rounded-md border border-red-500/70 bg-red-950/85 px-3 py-2 text-red-100">
          ROVER B DOWN — sector renegotiation live
        </div>
      ) : null}
      {cDead ? (
        <div className="rounded-md border border-orange-500/70 bg-orange-950/85 px-3 py-2 text-orange-100">
          RoverC lost — survivors re-split again
        </div>
      ) : null}
    </div>
  );
}
