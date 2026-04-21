import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRuntimeState } from "@/hooks/useRuntimeState";
import { useRuntimeStore } from "@/lib/state/runtimeStore";
import { selectPendingTaskCount } from "@/lib/state/selectors";

export function TaskBoard() {
  const { tasks, flatEnvelope } = useRuntimeState();
  const assignTask = useRuntimeStore((s) => s.assignTask);
  const pending = selectPendingTaskCount(tasks);

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Tasks</CardTitle>
        <Button size="sm" variant="secondary" onClick={() => void assignTask()}>
          Assign demo task
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        <p className="text-zinc-500">{pending} pending / bidding · source {flatEnvelope.source}</p>
        {tasks.length === 0 && <p className="text-zinc-600">No tasks yet — advance mission or assign.</p>}
        {tasks.map((t) => (
          <div key={t.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-2 py-2">
            <div className="flex justify-between gap-2">
              <span className="font-mono text-emerald-400/90">{t.id}</span>
              <span className="uppercase text-zinc-500">{t.status}</span>
            </div>
            <div className="text-zinc-400">{t.type}</div>
            {t.assignee && <div className="text-zinc-500">assignee {t.assignee}</div>}
            {t.scoreHint && <div className="text-zinc-500">score {t.scoreHint}</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
