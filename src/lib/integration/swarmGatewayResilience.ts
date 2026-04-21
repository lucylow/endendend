import { isHostedIntegrationPreview } from "@/lib/integration/hostedPreview";

function envFlag(v: string | undefined): boolean {
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Hosted preview always soft-fails to demo payloads.
 * Local/dev: set ``VITE_SWARM_BACKEND_DEMO_FALLBACK=1`` to use the same demo snapshot when the gateway is down.
 */
export function isSwarmGatewayDemoFallbackEnabled(): boolean {
  if (isHostedIntegrationPreview()) return true;
  const raw = import.meta.env.VITE_SWARM_BACKEND_DEMO_FALLBACK as string | undefined;
  return envFlag(raw);
}

/** Stable user-facing / log strings for gateway fetch failures. */
export function formatGatewayError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "AbortError" || /aborted|timeout/i.test(err.message)) {
      return err.message.includes("timed out") ? err.message : "Request timed out or was aborted";
    }
    return err.message;
  }
  return String(err);
}
