import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SwarmMap } from "@/components/SwarmMap";
import { MapSyncStatus } from "@/components/MapSyncStatus";
import { NodeMemoryPanel } from "@/components/NodeMemoryPanel";
import { MapDeltaFeed } from "@/components/MapDeltaFeed";
import { PeerSectorOwnership } from "@/components/PeerSectorOwnership";
import { FoxMqRecoveryPanel } from "@/components/FoxMqRecoveryPanel";
import { FoxMqDebugPanel } from "@/components/FoxMqDebugPanel";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";
const BlackoutWorldMap3D = lazy(() =>
  import("@/components/blackout/BlackoutWorldMap3D").then((m) => ({ default: m.BlackoutWorldMap3D })),
);

type Props = {
  view: VertexSwarmView | null;
  /** Drives subtle map chrome / overlays for the active SAR scenario. */
  scenario?: string | null;
  /** When false, skip heavy Three.js map (mobile / reduced capability). */
  show3D?: boolean;
  onSnapshot: () => void;
  onReplay: () => void;
  onStamp: () => void;
  onRecoverSample: () => void;
};

function Map3DFallback() {
  return (
    <div className="h-[200px] rounded-lg border border-zinc-800 bg-zinc-950/60 flex items-center justify-center text-xs text-muted-foreground">
      Loading 3D map…
    </div>
  );
}

export function SharedWorldMapPanel({
  view,
  scenario,
  show3D = true,
  onSnapshot,
  onReplay,
  onStamp,
  onRecoverSample,
}: Props) {
  const fox = view?.foxmqMap?.public ?? null;
  const profile = view?.foxmqMap?.scenarioProfile ?? null;
  const ledger = view?.foxmqMap?.ledgerTail ?? [];
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card/90 to-card/40">
      <CardHeader className="py-3 space-y-1">
        <CardTitle className="text-sm">Tashi / FoxMQ — distributed world map</CardTitle>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Monotonic merge-safe cells, mesh gossip with partition buffering, collective retention when peers drop, and
          rejoin rehydration — same state shape for mock fallback and live broker paths.
        </p>
        <MapSyncStatus fox={fox} />
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onSnapshot}>
            Snapshot sync
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onReplay}>
            Replay ledger
          </Button>
          <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={onStamp}>
            Manual delta (0,0)
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onRecoverSample}>
            Recover relay node
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="space-y-3 xl:col-span-2">
          {show3D ? (
            <Suspense fallback={<Map3DFallback />}>
              <BlackoutWorldMap3D view={view} scenario={scenario ?? view?.scenario} />
            </Suspense>
          ) : null}
          <SwarmMap view={view} scenario={scenario ?? view?.scenario} />
          <FoxMqDebugPanel profile={profile} />
        </div>
        <div className="space-y-3">
          <NodeMemoryPanel
            collectiveHealthPct={fox ? fox.collectiveMemoryHealth01 * 100 : 0}
            recoveryPct={fox ? fox.recoveryProgress01 * 100 : 0}
            offlinePreserved={fox?.offlineContributionsPreserved ?? {}}
          />
          <FoxMqRecoveryPanel
            mergeConflicts={fox?.mergeConflictsResolved ?? 0}
            duplicateDrops={fox?.duplicateDeltasDropped ?? 0}
            ledgerEvents={fox?.ledgerEventCount ?? 0}
          />
          <div>
            <h3 className="text-xs font-semibold mb-1">Peer sector ownership</h3>
            <PeerSectorOwnership exploration={view?.exploration ?? []} />
          </div>
          <div>
            <h3 className="text-xs font-semibold mb-1">Map delta / recovery feed</h3>
            <MapDeltaFeed events={ledger} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
