import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { VictimPriority } from "../types";

export function LiveExtractionPanel({
  priorities,
  ros2Connected,
  onExtract,
}: {
  priorities: VictimPriority[];
  ros2Connected: boolean;
  onExtract: (victimId: string) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "deploying" | "complete">("idle");
  const top = priorities[0];

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Live extraction</h3>
          <p className="text-xs text-muted-foreground">ROS2 arm + DroneKit handoff (simulated bridge)</p>
        </div>
        <Badge variant={ros2Connected ? "default" : "secondary"}>
          ROS2 {ros2Connected ? "connected" : "standby"}
        </Badge>
      </div>

      <ol className="space-y-2 text-xs text-muted-foreground">
        <li>1. Multi-camera YOLO + thermal fusion</li>
        <li>2. Vertex stake-weighted triage</li>
        <li>3. Magnetic convergence + role reassignment</li>
        <li>4. Physical extract (override below)</li>
      </ol>

      <Button
        type="button"
        className="w-full bg-red-600 text-white hover:bg-red-700"
        disabled={!top || phase === "deploying"}
        onClick={() => {
          if (!top) return;
          setPhase("deploying");
          onExtract(top.victimId);
          toast.message("Extraction ordered", { description: `Priority victim ${top.victimId}` });
          window.setTimeout(() => setPhase("complete"), 900);
          window.setTimeout(() => setPhase("idle"), 2400);
        }}
      >
        EXTRACT PRIORITY VICTIM #1
      </Button>

      {top ? (
        <p className="font-mono text-[11px] text-teal-600/90 dark:text-teal-300">
          Target {top.victimId} · consensus {(top.consensusScore * 100).toFixed(1)} · fused {(top.fusedScore * 100).toFixed(0)}%
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Awaiting detections…</p>
      )}
    </div>
  );
}
