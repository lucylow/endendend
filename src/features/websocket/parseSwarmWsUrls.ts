const DEFAULT_WS = "ws://127.0.0.1:8080/telemetry";

function isValidWebSocketUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "ws:" || u.protocol === "wss:";
  } catch {
    return false;
  }
}

/**
 * Prefer `VITE_SWARM_WS_URLS` (comma-separated) for multi-gateway P2P merge; else single `VITE_SWARM_WS_URL`.
 * Uses numeric IPs in defaults to avoid DNS for offline / “cloud rip” demos.
 */
export function parseSwarmWsUrls(): string[] {
  const multi = import.meta.env.VITE_SWARM_WS_URLS?.trim();
  if (multi) {
    const parts = multi
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter(isValidWebSocketUrl);
    if (parts.length) return parts;
  }
  const single = (import.meta.env.VITE_SWARM_WS_URL?.trim() || DEFAULT_WS).trim();
  if (isValidWebSocketUrl(single)) return [single];
  return [DEFAULT_WS];
}
