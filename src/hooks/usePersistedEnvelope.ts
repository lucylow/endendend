import { useEffect } from "react";
import type { FlatMissionEnvelope } from "@/lib/state/types";

const KEY = "blackout-envelope-v1";

/** Persists the last flat mission envelope for brief offline / reload continuity. */
export function usePersistedEnvelope(envelope: FlatMissionEnvelope | null) {
  useEffect(() => {
    if (!envelope?.missionId) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), envelope }));
    } catch {
      /* quota / private mode */
    }
  }, [envelope]);
}

export function readPersistedEnvelope(): FlatMissionEnvelope | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { envelope: FlatMissionEnvelope };
    return parsed.envelope ?? null;
  } catch {
    return null;
  }
}
