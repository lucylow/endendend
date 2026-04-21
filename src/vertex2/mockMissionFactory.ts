import type { MeshTaskSpec } from "./taskAllocator";

let serial = 1;

export function nextMockMeshTask(prefersRelay: boolean): MeshTaskSpec {
  const kinds = ["scout_sector", "relay_extension", "rescue_lift", "sensor_sweep"];
  const id = serial++;
  return {
    taskId: `mesh-task-${id}`,
    kind: kinds[(id + (prefersRelay ? 1 : 0)) % kinds.length],
    prefersRelay,
    scenarioHint: "local_autonomy_ready",
  };
}
