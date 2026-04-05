import { motion } from "framer-motion";
import { Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSwarmStore } from "@/store/swarmStore";
import { FOXMQ_REPLICATION_FACTOR } from "@/config/foxmq";

export default function ExplorationGrid() {
  const grid = useSwarmStore((s) => s.grid);
  const progress = useSwarmStore((s) => s.explorationProgress);
  const exploredCellsFoxmq = useSwarmStore((s) => s.exploredCellsFoxmq);
  const foxmqConnected = useSwarmStore((s) => s.foxmqConnected);
  const foxmqNodeId = useSwarmStore((s) => s.foxmqNodeId);
  const resyncWorldMapFromFoxmq = useSwarmStore((s) => s.resyncWorldMapFromFoxmq);

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-mono text-xs text-muted-foreground tracking-wider">AREA EXPLORATION</h4>
        <span className="font-mono text-xs text-primary">{progress.toFixed(0)}% covered</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 mb-4">
        <motion.div
          className="bg-primary h-1.5 rounded-full"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${grid[0]?.length || 10}, 1fr)` }}>
        {grid.flat().map((cell) => (
          <motion.div
            key={`${cell.row}-${cell.col}`}
            className={`aspect-square rounded-sm transition-colors duration-300 ${
              cell.searched ? "bg-primary/40" : "bg-muted/50"
            }`}
            initial={false}
            animate={cell.searched ? { scale: [1, 1.2, 1] } : {}}
            title={cell.searched ? `Searched by ${cell.searchedBy}` : `Cell (${cell.row}, ${cell.col})`}
          />
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          <Database className="w-3 h-3 shrink-0 text-primary" />
          <span>FoxMQ world map</span>
          <span className="text-foreground/80">{foxmqConnected ? "replicated" : "idle"}</span>
          {foxmqConnected && <span className="text-muted-foreground">· rf={FOXMQ_REPLICATION_FACTOR}</span>}
        </div>
        {foxmqNodeId && (
          <p className="text-[10px] font-mono text-muted-foreground truncate" title={foxmqNodeId}>
            node {foxmqNodeId} · {exploredCellsFoxmq.length} cells in KV
          </p>
        )}
        <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] font-mono w-full" disabled={!foxmqConnected} onClick={() => resyncWorldMapFromFoxmq()}>
          Resync map from FoxMQ
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">Each cell represents a grid sector. Lit cells have been searched. Open a second browser tab while exploring to see cross-tab replication (simulated cluster).</p>
    </div>
  );
}
