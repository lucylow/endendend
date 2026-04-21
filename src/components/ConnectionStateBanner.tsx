import { memo, useEffect, useState } from "react";
import { WifiOff, AlertTriangle } from "lucide-react";

export const ConnectionStateBanner = memo(function ConnectionStateBanner({
  lastUpdateMs,
  staleAfterMs = 10_000,
}: {
  lastUpdateMs: number | null;
  staleAfterMs?: number;
}) {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const stale = lastUpdateMs != null && Date.now() - lastUpdateMs > staleAfterMs;

  if (!online) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 mb-4"
        role="status"
      >
        <WifiOff className="w-4 h-4 shrink-0" aria-hidden />
        Network offline — using last known swarm envelope where possible.
      </div>
    );
  }

  if (stale) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-orange-500/35 bg-orange-500/10 px-3 py-2 text-xs text-orange-100 mb-4"
        role="status"
      >
        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
        Telemetry stale ({Math.round((Date.now() - (lastUpdateMs ?? 0)) / 1000)}s since last update).
      </div>
    );
  }

  return null;
});
