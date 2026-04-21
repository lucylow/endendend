import { useEffect, useMemo, useState } from "react";
import { Activity, Link2, Sparkles, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createDemoSwarmBackendHealth, createDemoSwarmBackendSnapshot } from "@/lib/integration/demoSwarmBackend";
import { isHostedIntegrationPreview } from "@/lib/integration/hostedPreview";
import { formatGatewayError, isSwarmGatewayDemoFallbackEnabled } from "@/lib/integration/swarmGatewayResilience";
import { readSwarmBackendHttpBase, SwarmBackendRealtime, SwarmGatewayClient, swarmBackendWsUrl } from "@/lib/tashi-sdk/swarmGatewayClient";
import type { SwarmBackendHealth, SwarmBackendSnapshot } from "@/lib/tashi-sdk/swarmBackendTypes";
import { cn } from "@/lib/utils";

type Props = {
  pollMs?: number;
  className?: string;
};

/**
 * When ``VITE_SWARM_BACKEND_HTTP`` is set (e.g. ``http://127.0.0.1:8090``), polls snapshot/health and optionally opens ``/ws``.
 * Demo payloads load when there is no base URL and preview/fallback mode is on, or after repeated failures if ``VITE_SWARM_BACKEND_DEMO_FALLBACK=1``.
 */
export default function BackendBridgeStrip({ pollMs = 8000, className }: Props) {
  const base = useMemo(() => readSwarmBackendHttpBase(), []);
  const previewHost = useMemo(() => isHostedIntegrationPreview(), []);
  const demoFallbackEnv = useMemo(() => isSwarmGatewayDemoFallbackEnabled(), []);
  const [snap, setSnap] = useState<SwarmBackendSnapshot | null>(null);
  const [health, setHealth] = useState<SwarmBackendHealth | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [wsLive, setWsLive] = useState(false);
  const [demoFallback, setDemoFallback] = useState(false);

  useEffect(() => {
    if (base || !demoFallbackEnv) return;
    setSnap(createDemoSwarmBackendSnapshot());
    setHealth(createDemoSwarmBackendHealth());
    setErr(null);
    setDemoFallback(false);
    setWsLive(false);
  }, [base, demoFallbackEnv]);

  useEffect(() => {
    if (!base) return;
    const client = new SwarmGatewayClient(base);
    let cancelled = false;
    const tick = async () => {
      const errs: string[] = [];
      let s: SwarmBackendSnapshot | null = null;
      let h: SwarmBackendHealth | null = null;
      try {
        s = await client.getSnapshot();
      } catch (e) {
        errs.push(`snapshot: ${formatGatewayError(e)}`);
      }
      try {
        h = await client.getHealth();
      } catch (e) {
        errs.push(`health: ${formatGatewayError(e)}`);
      }
      if (!cancelled) {
        if (s) setSnap(s);
        if (h) setHealth(h);
        if (s && h) {
          setErr(null);
          setDemoFallback(false);
        } else if (s || h) {
          setErr(errs.length ? errs.join(" · ") : null);
          setDemoFallback(false);
        } else if (demoFallbackEnv) {
          setSnap(createDemoSwarmBackendSnapshot());
          setHealth(createDemoSwarmBackendHealth());
          setErr(errs.length ? errs.join(" · ") : null);
          setDemoFallback(true);
        } else {
          setErr(errs.join(" · "));
          setDemoFallback(false);
        }
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [base, pollMs, demoFallbackEnv]);

  useEffect(() => {
    if (!base || typeof WebSocket === "undefined") return;
    const rt = new SwarmBackendRealtime(swarmBackendWsUrl(base));
    rt.connect(
      (s) => {
        setSnap(s);
        setWsLive(true);
        setDemoFallback(false);
        setErr(null);
      },
      {
        onError: () => {
          setWsLive(false);
          setErr((prev) => (prev ? `${prev} · ws error` : "WebSocket error (HTTP poll continues)"));
        },
        onClose: () => setWsLive(false),
      },
    );
    return () => {
      rt.disconnect();
      setWsLive(false);
    };
  }, [base, demoFallbackEnv]);

  if (!base && !demoFallbackEnv) return null;

  const mesh = snap?.tashi?.mesh;
  const chainV = snap?.tashi?.chainHint?.monotonicMeshVersion ?? mesh?.version;
  const sar = snap?.tashi?.sar;
  const baseLabel = base ? base.replace(/^https?:\/\//, "") : "simulated-gateway";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-muted/20 px-3 py-2 text-[11px] font-mono text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 text-foreground/90">
        {!base && demoFallbackEnv ? (
          <Sparkles className="h-3.5 w-3.5 text-sky-400" />
        ) : (
          <Link2 className="h-3.5 w-3.5 text-primary" />
        )}
        Backend
      </span>
      {!base && demoFallbackEnv ? (
        <Badge variant="outline" className="text-[10px] font-mono border-sky-500/40 text-sky-300/90">
          {previewHost ? "preview · illustrative" : "demo fallback · illustrative"}
        </Badge>
      ) : null}
      {demoFallback ? (
        <Badge variant="outline" className="max-w-[220px] truncate text-[10px] font-sans border-amber-500/35 text-amber-200/90">
          live URL unreachable · showing preview payload
        </Badge>
      ) : null}
      {(base || !demoFallbackEnv) && (
        <Badge variant="outline" className="text-[10px] font-mono border-primary/30">
          {baseLabel}
        </Badge>
      )}
      {wsLive ? (
        <span className="inline-flex items-center gap-0.5 text-emerald-500/90">
          <Activity className="h-3 w-3" />
          ws
        </span>
      ) : (
        <span className="inline-flex items-center gap-0.5 opacity-70">
          <Unplug className="h-3 w-3" />
          {base ? "poll" : "static"}
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
      {sar?.missionPhase != null && sar.missionPhase !== "" && (
        <span>
          SAR phase <span className="text-foreground">{String(sar.missionPhase)}</span>
        </span>
      )}
      {err && !demoFallback && <span className="text-destructive truncate max-w-[240px]">{err}</span>}
      {err && demoFallback && <span className="text-amber-200/80 truncate max-w-[240px] text-[10px] font-sans">{err}</span>}
    </div>
  );
}
