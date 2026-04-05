import { motion } from "framer-motion";
import { useSwarmStore } from "@/store/swarmStore";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Shield, Zap, Wifi, Bug, Play } from "lucide-react";
import type { ConsensusInstance } from "@/types";

const phaseColors: Record<string, string> = {
  idle: "bg-muted text-muted-foreground",
  pre_prepare: "bg-warning/20 text-warning",
  prepare: "bg-accent/20 text-accent",
  commit: "bg-primary/20 text-primary",
  decided: "bg-success/20 text-success",
  failed: "bg-destructive/20 text-destructive",
};

export default function BFTConsensusPanel() {
  const { consensusInstances, consensusMetrics, faultConfig, setFaultConfig, runConsensus, agents, consensusOrderedSeq } =
    useSwarmStore();
  const byzantineCount = agents.filter((a) => a.isByzantine).length;
  const n = agents.filter((a) => a.status === "active").length;
  const maxF = Math.floor((n - 1) / 3);

  return (
    <div className="space-y-4">
      {/* Fault Injection Controls */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Bug className="w-4 h-4 text-destructive" />
          <h4 className="font-mono text-xs text-muted-foreground tracking-wider">FAULT INJECTION</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-muted-foreground font-mono">PACKET LOSS: {faultConfig.packetLoss}%</label>
            <Slider min={0} max={90} step={5} value={[faultConfig.packetLoss]} onValueChange={([v]) => setFaultConfig({ packetLoss: v })} className="mt-1" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-mono">LATENCY: +{faultConfig.latencyMs}ms</label>
            <Slider min={0} max={2000} step={50} value={[faultConfig.latencyMs]} onValueChange={([v]) => setFaultConfig({ latencyMs: v })} className="mt-1" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-mono">BYZANTINE NODES: {faultConfig.byzantineNodes} / {n} (max f={maxF})</label>
            <Slider min={0} max={Math.min(n - 1, 4)} step={1} value={[faultConfig.byzantineNodes]} onValueChange={([v]) => setFaultConfig({ byzantineNodes: v })} className="mt-1" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-mono block mb-1">FAULT TYPE</label>
            <div className="flex gap-1 flex-wrap">
              {(["none", "drop", "delay", "corrupt"] as const).map((ft) => (
                <Button key={ft} size="sm" variant={faultConfig.faultType === ft ? "default" : "outline"} className="h-6 text-[10px] capitalize" onClick={() => setFaultConfig({ faultType: ft })}>
                  {ft}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Consensus trigger */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-primary" />
          <h4 className="font-mono text-xs text-muted-foreground tracking-wider">BFT CONSENSUS</h4>
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">
            n={n} f={byzantineCount} q={Math.floor((2 * n) / 3) + 1} order={consensusOrderedSeq}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap mb-4">
          {(["explorer_election", "relay_insertion", "task_acceptance"] as const).map((t) => (
            <Button key={t} size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => runConsensus(t)}>
              <Play className="w-3 h-3" />
              {t.replace("_", " ")}
            </Button>
          ))}
        </div>

        {/* Recent instances */}
        <div className="space-y-2 max-h-52 overflow-y-auto">
          {consensusInstances.slice(-8).reverse().map((inst) => (
            <ConsensusRow key={inst.id} inst={inst} />
          ))}
          {consensusInstances.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Run a consensus round to see results.</p>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-warning" />
          <h4 className="font-mono text-xs text-muted-foreground tracking-wider">CONSENSUS METRICS</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Attempts" value={consensusMetrics.totalAttempts} />
          <MetricCard label="Success Rate" value={consensusMetrics.totalAttempts > 0 ? `${((consensusMetrics.successes / consensusMetrics.totalAttempts) * 100).toFixed(0)}%` : "—"} />
          <MetricCard label="Avg Latency" value={consensusMetrics.avgLatencyMs > 0 ? `${consensusMetrics.avgLatencyMs.toFixed(0)}ms` : "—"} />
          <MetricCard label="Byzantine Blocked" value={consensusMetrics.byzantineFaultsDetected} />
        </div>

        {/* Success rate mini-chart */}
        {consensusMetrics.successRateHistory.length > 1 && (
          <div className="mt-3">
            <label className="text-[10px] text-muted-foreground font-mono">SUCCESS RATE OVER TIME</label>
            <div className="flex items-end gap-[2px] h-12 mt-1">
              {consensusMetrics.successRateHistory.slice(-30).map((v, i) => (
                <div key={i} className="flex-1 rounded-t-sm transition-all" style={{ height: `${Math.max(2, v)}%`, backgroundColor: v >= 66 ? "hsl(var(--success))" : v >= 33 ? "hsl(var(--warning))" : "hsl(var(--destructive))" }} />
              ))}
            </div>
          </div>
        )}

        {/* Latency mini-chart */}
        {consensusMetrics.latencyHistory.length > 1 && (
          <div className="mt-3">
            <label className="text-[10px] text-muted-foreground font-mono">LATENCY (ms)</label>
            <div className="flex items-end gap-[2px] h-12 mt-1">
              {consensusMetrics.latencyHistory.slice(-30).map((v, i) => {
                const maxVal = Math.max(...consensusMetrics.latencyHistory.slice(-30), 1);
                return <div key={i} className="flex-1 bg-primary/60 rounded-t-sm transition-all" style={{ height: `${(v / maxVal) * 100}%` }} />;
              })}
            </div>
          </div>
        )}
      </div>

      {/* Byzantine agents */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wifi className="w-4 h-4 text-destructive" />
          <h4 className="font-mono text-xs text-muted-foreground tracking-wider">NODE STATUS</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {agents.map((a) => (
            <div key={a.id} className={`rounded-lg px-3 py-2 text-xs border transition-colors ${a.isByzantine ? "border-destructive/50 bg-destructive/10" : "border-border bg-muted/30"}`}>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${a.isByzantine ? "bg-destructive" : "bg-success"}`} />
                <span className="font-medium text-foreground">{a.name}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {a.role} • {a.isByzantine ? "BYZANTINE" : "honest"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConsensusRow({ inst }: { inst: ConsensusInstance }) {
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="rounded-lg bg-muted/30 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground font-mono">#{inst.seq} {inst.type.replace("_", " ")}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${phaseColors[inst.phase] || ""}`}>{inst.phase}</span>
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
        <span>v{inst.view}</span>
        <span>pri:{inst.primaryId.slice(-6)}</span>
        <span>P:{inst.prepareVotes.length}</span>
        <span>C:{inst.commitVotes.length}</span>
        {inst.latencyMs != null && <span>{inst.latencyMs}ms</span>}
        {inst.orderedSeq != null && <span className="text-primary">ord:{inst.orderedSeq}</span>}
        {inst.byzantineVotes > 0 && <span className="text-destructive">{inst.byzantineVotes} byz</span>}
      </div>
    </motion.div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/30 p-2.5">
      <div className="font-mono text-lg font-bold text-primary">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
