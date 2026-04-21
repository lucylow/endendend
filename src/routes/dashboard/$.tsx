import { createFileRoute, redirect } from "@tanstack/react-router";

function mapLegacyDashboard(pathname: string): { to: string; params?: Record<string, string> } {
  const rest = pathname.replace(/^\/dashboard\/?/, "");
  const segments = rest.split("/").filter(Boolean);
  const head = segments[0] ?? "";
  const tail = segments[1] ?? "";
  if (!head) return { to: "/swarm" };
  if (head === "replay") return { to: "/replay" };
  if (head === "analytics") return { to: "/metrics" };
  if (head === "auctions") return { to: "/tasks" };
  if (head === "vertex-swarm") return { to: "/vertex" };
  if (head === "swarm") return { to: "/swarm" };
  if (head === "victim-detection") return { to: "/safety" };
  if (head === "settings") return { to: "/settings" };
  if (head === "billing" || head === "staking") return { to: "/settings" };
  if (head === "agents" && tail) return { to: "/drones/$id", params: { id: tail } };
  if (head === "agents") return { to: "/drones" };
  if (head === "scenarios") return { to: "/scenarios/search-rescue" };
  if (head === "scalability") return { to: "/metrics" };
  if (head === "simulation") return { to: "/worlds" };
  return { to: "/swarm" };
}

export const Route = createFileRoute("/dashboard/$")({
  beforeLoad: ({ location }) => {
    const { to, params } = mapLegacyDashboard(location.pathname);
    throw redirect({ to, params, replace: true });
  },
});
