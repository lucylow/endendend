import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRuntimeStore } from "@/lib/state/runtimeStore";
import { recentEvents } from "@/lib/state/selectors";

export function DebugFeed() {
  const log = useRuntimeStore((s) => s.eventLog);
  const rows = recentEvents(log, 40).slice().reverse();

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Event feed</CardTitle>
      </CardHeader>
      <CardContent className="max-h-48 overflow-y-auto font-mono text-[10px] text-zinc-400 space-y-1 pr-1">
        {rows.map((e) => (
          <div key={e.id} className="border-b border-zinc-800/40 pb-1">
            <span className="text-zinc-600">{new Date(e.ts).toLocaleTimeString()}</span>{" "}
            <span className="text-sky-500/90">{e.kind}</span>{" "}
            <span className="text-zinc-500">[{e.source}]</span> {e.message}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
