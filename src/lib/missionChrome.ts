/** Routes that use mission control chrome (sidebar + mobile nav + E-STOP FAB). */
const MISSION_PREFIXES = [
  "/swarm",
  "/drone",
  "/safety",
  "/replay",
  "/metrics",
  "/logs",
  "/tasks",
  "/vertex",
  "/network",
  "/settings",
  "/drones",
  "/worlds",
] as const;

export function pathUsesMissionChrome(pathname: string): boolean {
  return MISSION_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function pathUsesMarketingShell(pathname: string): boolean {
  if (pathname === "/" || pathname === "/features" || pathname === "/demo") return true;
  return false;
}
