const SESSION_KEY = "foxmq_drone_node_id";

export function createDroneNodeId(): string {
  if (typeof sessionStorage === "undefined") return `drone-${Math.random().toString(36).slice(2, 9)}`;
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `drone-${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[FoxMQ] sessionStorage unavailable, ephemeral node id", e);
    return `drone-${Math.random().toString(36).slice(2, 9)}`;
  }
}
