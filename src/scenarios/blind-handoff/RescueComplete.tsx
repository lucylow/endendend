import { useEffect, useRef, useState } from "react";
import { useSwarmStore } from "@/stores/swarmStore";

export function RescueComplete() {
  const rescues = useSwarmStore((s) => s.rescues_completed);
  const prev = useRef(rescues);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (rescues > prev.current) {
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 3200);
      prev.current = rescues;
      return () => window.clearTimeout(t);
    }
    prev.current = rescues;
  }, [rescues]);

  if (!flash) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-10 z-30 flex justify-center">
      <div className="rounded-full border border-emerald-400/50 bg-emerald-950/80 px-6 py-2 text-sm font-semibold text-emerald-100 shadow-xl backdrop-blur">
        Rescue complete — victim stabilized
      </div>
    </div>
  );
}
