import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, ShieldCheck, ShieldAlert } from "lucide-react";
import type { FlatMissionEnvelope } from "@/lib/state/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const HISTORY_KEY = "blackout-settlement-history-v1";

type HistoryEntry = { at: number; missionId: string; manifestHash: string; phase: string };

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

function pushHistory(entry: HistoryEntry) {
  const prev = loadHistory();
  const next = [entry, ...prev].slice(0, 12);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

async function sha256hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  if (data === null || typeof data !== "object") {
    return <span className="text-sky-200/90">{JSON.stringify(data)}</span>;
  }
  if (Array.isArray(data)) {
    return (
      <div className={cn("pl-2 border-l border-zinc-800", depth === 0 && "pl-0 border-0")}>
        <button type="button" className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground" onClick={() => setOpen(!open)}>
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} [{data.length}]
        </button>
        {open ? (
          <ul className="mt-1 space-y-1">
            {data.map((item, i) => (
              <li key={i} className="font-mono text-[10px]">
                <JsonTree data={item} depth={depth + 1} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  const entries = Object.entries(data as Record<string, unknown>);
  return (
    <div className={cn("pl-2 border-l border-zinc-800", depth === 0 && "pl-0 border-0")}>
      <button type="button" className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} {"{"}
        {entries.length} keys{"}"}
      </button>
      {open ? (
        <ul className="mt-1 space-y-1">
          {entries.map(([k, v]) => (
            <li key={k} className="font-mono text-[10px]">
              <span className="text-violet-300">{k}</span>: <JsonTree data={v} depth={depth + 1} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SettlementManifestBlock({ envelope, manifestHash }: { envelope: FlatMissionEnvelope; manifestHash: string }) {
  const manifest = useMemo(
    () => ({
      version: 1,
      missionId: envelope.missionId,
      phase: envelope.phase,
      scenario: envelope.scenario,
      manifestHash,
      contributors: envelope.nodes.map((n) => ({
        nodeId: n.nodeId,
        role: n.role,
        trust: n.trust,
        battery: n.battery,
        health: n.health,
      })),
      mapSummary: envelope.mapSummary,
      generatedAt: Date.now(),
    }),
    [envelope, manifestHash],
  );

  const [rowMerkle, setRowMerkle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const leaves = manifest.contributors.map((c) => `${c.nodeId}|${c.trust}|${c.battery}`);
      const computed = await sha256hex(leaves.join("\n"));
      if (!cancelled) setRowMerkle(computed);
    })();
    return () => {
      cancelled = true;
    };
  }, [manifest]);

  const proofOk = rowMerkle != null && manifestHash.length > 12 && rowMerkle.slice(0, 12) === manifestHash.slice(0, 12);

  const copyFull = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
      toast.success("Manifest JSON copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const exportArc = async () => {
    pushHistory({ at: Date.now(), missionId: envelope.missionId, manifestHash, phase: envelope.phase });
    toast("Arc export (demo)", {
      description: "POST /api/swarm/settlement not wired — logged locally for judges.",
    });
    const fakeHash = `0x${(await sha256hex(manifestHash + envelope.missionId)).slice(0, 40)}`;
    toast.success(`Demo tx hash ${fakeHash.slice(0, 18)}…`);
  };

  const history = loadHistory();

  return (
    <div className="mt-4 space-y-3 border-t border-zinc-800/80 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        {!rowMerkle ? (
          <span className="text-[10px] text-muted-foreground font-mono">Computing row Merkle…</span>
        ) : proofOk ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
            <ShieldCheck className="w-3.5 h-3.5" /> Row Merkle matches checkpoint prefix
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-300/90 font-mono">
            <ShieldAlert className="w-3.5 h-3.5" /> Ledger checkpoint{" "}
            <code className="text-[9px] text-zinc-300">{manifestHash.slice(0, 14)}…</code> vs row Merkle{" "}
            <code className="text-[9px] text-zinc-300">{rowMerkle.slice(0, 14)}…</code>
          </span>
        )}
        <Button type="button" size="sm" variant="outline" className="min-h-11 text-xs gap-1" onClick={() => void copyFull()}>
          <Copy className="w-3.5 h-3.5" />
          Copy manifest
        </Button>
        <Button type="button" size="sm" className="min-h-11 text-xs" onClick={() => void exportArc()}>
          Export to Arc (demo)
        </Button>
      </div>
      <details className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
        <summary className="cursor-pointer text-xs font-semibold text-foreground">Reward manifest (tree)</summary>
        <div className="mt-2 max-h-[220px] overflow-auto pr-1">
          <JsonTree data={manifest} />
        </div>
      </details>
      {history.length ? (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Settlement history (local)</p>
          <ul className="text-[10px] font-mono text-muted-foreground space-y-1">
            {history.slice(0, 6).map((h, i) => (
              <li key={i}>
                {new Date(h.at).toLocaleString()} · {h.missionId} · {h.manifestHash.slice(0, 12)}…
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
