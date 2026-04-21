import { useSwarmStore } from "@/stores/swarmStore";

export function FailureOverlay() {
  const rovers = useSwarmStore((s) => s.rovers);
  const time = useSwarmStore((s) => s.time);
  const meta = useSwarmStore((s) => s.fallenScenarioMeta);
  const b = rovers.find((r) => r.id === "RoverB");
  const c = rovers.find((r) => r.id === "RoverC");
  const bDead = b?.state === "dead";
  const cDead = c?.state === "dead";
  const commStart = typeof meta?.rover_b_comm_loss_start_s === "number" ? meta.rover_b_comm_loss_start_s : 27;
  const hbTimeout = typeof meta?.heartbeat_timeout_s === "number" ? meta.heartbeat_timeout_s : 3;
  const expectDead =
    typeof meta?.expected_rover_b_dead_s === "number" ? meta.expected_rover_b_dead_s : commStart + hbTimeout;
  const hbLoss = b && !bDead && time >= commStart && time < expectDead;

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
