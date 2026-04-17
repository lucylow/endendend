import { useEffect, useMemo, useState } from "react";
import { Activity, Link2, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { readSwarmBackendHttpBase, SwarmBackendRealtime, SwarmGatewayClient, swarmBackendWsUrl } from "@/lib/tashi-sdk/swarmGatewayClient";
import type { SwarmBackendHealth, SwarmBackendSnapshot } from "@/lib/tashi-sdk/swarmBackendTypes";
import { cn } from "@/lib/utils";

type Props = {
  pollMs?: number;
  className?: string;
};

/**
 * When ``VITE_SWARM_BACKEND_HTTP`` is set (e.g. ``http://127.0.0.1:8090``), polls snapshot/health and optionally opens ``/ws``.
 */
export default function BackendBridgeStrip({ pollMs = 8000, className }: Props) {
  const base = useMemo(() => readSwarmBackendHttpBase(), []);
  const [snap, setSnap] = useState<SwarmBackendSnapshot | null>(null);
  const [health, setHealth] = useState<SwarmBackendHealth | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [wsLive, setWsLive] = useState(false);

  useEffect(() => {
    if (!base) return;
    const client = new SwarmGatewayClient(base);
    let cancelled = false;
    const tick = async () => {
      try {
        const [s, h] = await Promise.all([client.getSnapshot(), client.getHealth()]);
        if (!cancelled) {
          setSnap(s);
          setHealth(h);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [base, pollMs]);

  useEffect(() => {
    if (!base || typeof WebSocket === "undefined") return;
    const rt = new SwarmBackendRealtime(swarmBackendWsUrl(base));
    rt.connect((s) => {
      setSnap(s);
      setWsLive(true);
    });
    return () => {
      rt.disconnect();
      setWsLive(false);
    };
  }, [base]);

  if (!base) return null;

  const mesh = snap?.tashi?.mesh;
  const chainV = snap?.tashi?.chainHint?.monotonicMeshVersion ?? mesh?.version;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-muted/20 px-3 py-2 text-[11px] font-mono text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 text-foreground/90">
        <Link2 className="h-3.5 w-3.5 text-primary" />
        Backend
      </span>
      <Badge variant="outline" className="text-[10px] font-mono border-primary/30">
        {base.replace(/^https?:\/\//, "")}
      </Badge>
      {wsLive ? (
        <span className="inline-flex items-center gap-0.5 text-emerald-500/90">
          <Activity className="h-3 w-3" />
          ws
        </span>
      ) : (
        <span className="inline-flex items-center gap-0.5 opacity-70">
          <Unplug className="h-3 w-3" />
          poll
        </span>
      )}
      {chainV != null && (
        <span>
          mesh v<span className="text-foreground">{chainV}</span>
        </span>
      )}
      {health != null && (
        <span>
          missions <span className="text-foreground">{health.mission_count}</span>
        </span>
      )}
      {snap?.missions?.length != null && (
        <span>
          snapshot missions <span className="text-foreground">{snap.missions.length}</span>
        </span>
      )}
      {err && <span className="text-destructive truncate max-w-[200px]">{err}</span>}
    </div>
  );
}
