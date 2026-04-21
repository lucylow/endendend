import { useEffect, useState } from "react";
import { BlindHandoffCanvas } from "./BlindHandoffCanvas";
import type { HandoffWorldJson } from "./types";

export default function BlindHandoffScenario() {
  const [world, setWorld] = useState<HandoffWorldJson | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/data/handoff/world_airground.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j || !Array.isArray(j.victims)) return;
        setWorld({
          bounds: j.bounds ?? [-100, 100, -100, 100],
          victims: j.victims,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setWorld({ bounds: [-100, 100, -100, 100], victims: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <BlindHandoffCanvas world={world} />;
}
