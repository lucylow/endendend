/**
 * Lovable / static-host preview: no Python gateway or billing server in the same deploy.
 * Opt in with ``VITE_INTEGRATION_PREVIEW=1``, or auto when the hostname looks like a Lovable preview
 * (unless ``VITE_INTEGRATION_PREVIEW=0`` disables auto-detection).
 */

function envFlag(v: string | undefined): boolean {
  return v === "1" || v === "true" || v === "yes";
}

function envDisabled(v: string | undefined): boolean {
  return v === "0" || v === "false" || v === "off";
}

function hostnameLooksLikeLovablePreview(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  return h.includes(".lovable.") || h === "lovable.app" || h.endsWith(".lovableproject.com");
}

/** UI + fetch helpers: softer errors and demo backend strip on Lovable-style hosts. */
export function isHostedIntegrationPreview(): boolean {
  const raw = import.meta.env.VITE_INTEGRATION_PREVIEW as string | undefined;
  if (envDisabled(raw)) return false;
  if (envFlag(raw)) return true;
  if (raw === "auto" || raw === undefined || raw === "") {
    return hostnameLooksLikeLovablePreview();
  }
  return false;
}
