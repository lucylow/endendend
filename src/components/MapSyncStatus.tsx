import { Badge } from "@/components/ui/badge";
import type { FoxMqMapPublicState } from "@/foxmq/mapSyncEngine";

type Props = { fox: FoxMqMapPublicState | null };

export function MapSyncStatus({ fox }: Props) {
  if (!fox) {
    return <p className="text-[11px] text-muted-foreground">FoxMQ map sync idle (no simulator view).</p>;
  }
  return (
    <div className="flex flex-wrap gap-2 text-[11px]">
      <Badge variant="outline" className="font-mono">
        v{fox.mapVersion}
      </Badge>
      <Badge variant="secondary">dirty {fox.dirtyDeltaCount}</Badge>
      <Badge variant="secondary">lag {fox.syncLagMs} ms</Badge>
      <Badge variant="outline">buf {fox.partitionBufferSize}</Badge>
      <Badge variant="outline">merges/tick {fox.meshMergesThisTick}</Badge>
      <Badge variant={fox.runtimeMode === "live" ? "default" : "secondary"}>{fox.runtimeMode}</Badge>
      {fox.lastSyncPeer && (
        <span className="text-muted-foreground">
          last peer <span className="font-mono text-foreground">{fox.lastSyncPeer}</span>
        </span>
      )}
    </div>
  );
}
