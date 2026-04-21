import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRuntimeStore } from "@/lib/state/runtimeStore";
import { useRuntimeState } from "@/hooks/useRuntimeState";
import { selectMissionPhaseLabel } from "@/lib/state/selectors";

export function MissionPanel() {
  const { flatEnvelope, loading, lastActionError } = useRuntimeState();
  const advancePhase = useRuntimeStore((s) => s.advancePhase);
  const addTarget = useRuntimeStore((s) => s.addTarget);
  const saveCheckpoint = useRuntimeStore((s) => s.saveCheckpoint);
  const pushEvent = useRuntimeStore((s) => s.pushEvent);
  const fastForwardDemo = useRuntimeStore((s) => s.fastForwardDemo);

  const phaseLabel = selectMissionPhaseLabel(flatEnvelope);
  const be = flatEnvelope.backend;

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Mission</CardTitle>
        <CardDescription className="text-xs font-mono">
          {flatEnvelope.missionId} · {phaseLabel}
          {be?.vertex?.lastCommittedHash && (
            <span className="block truncate text-zinc-500">vertex {be.vertex.lastCommittedHash.slice(0, 14)}…</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {loading && <p className="text-xs text-zinc-500">Loading engine…</p>}
        {lastActionError && <p className="text-xs text-amber-400">{lastActionError}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={loading} onClick={() => void advancePhase()}>
            Advance phase
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void addTarget(`victim-${Date.now().toString(36)}`)}>
            Report target
          </Button>
          <Button size="sm" variant="outline" onClick={() => void saveCheckpoint(`ckpt-${Date.now().toString(36)}`)}>
            Checkpoint
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void fastForwardDemo()}>
            Fast-forward to terminal
          </Button>
        </div>
        {be?.budgetCompliance === false && (
          <p className="text-xs text-amber-400">Lattice budget gate: scenario floors not met for next hop.</p>
        )}
        {be?.allocationPreview && (
          <p className="text-[11px] text-zinc-400 leading-snug">{be.allocationPreview.topExplanation}</p>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-[11px] h-7"
          onClick={() => pushEvent("operator", "Manual tick", flatEnvelope.source)}
        >
          Log operator note
        </Button>
      </CardContent>
    </Card>
  );
}
